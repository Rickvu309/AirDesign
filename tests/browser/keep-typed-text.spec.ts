import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { newBlankDeck } from "./new-deck"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const clean = join(fixtures, "clean.pptx")
const notesDeck = join(fixtures, "nasa-1d-cnn.pptx")
const typedTitle = "Typed on a new slide"
const typedNotes = "Remember the result & the next step."
const emuPerPixel = 15_240

declare global {
  interface Window {
    deviceDelay?: number
  }
}

test.use({ viewport: { width: 1600, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const begin = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (
      this: IDBDatabase,
      stores: string | string[],
      mode?: IDBTransactionMode,
      options?: IDBTransactionOptions,
    ) {
      const delay = window.deviceDelay
      if (mode !== "readwrite" || delay === undefined) return begin.call(this, stores, mode, options)
      type Operation = {
        method: "getAll" | "put" | "delete"
        args: unknown[]
        request: { result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null }
      }
      const waiting: Operation[] = []
      const facade = { oncomplete: null as (() => void) | null, onerror: null, onabort: null }
      let store: IDBObjectStore | null = null
      const run = (operation: Operation) => {
        const real = (store as unknown as Record<string, (...args: unknown[]) => IDBRequest>)[operation.method]?.apply(
          store,
          operation.args,
        )
        if (real === undefined) return
        real.onsuccess = () => {
          operation.request.result = real.result
          operation.request.onsuccess?.()
        }
        real.onerror = () => operation.request.onerror?.()
      }
      const queue = (method: Operation["method"], ...args: unknown[]) => {
        const operation: Operation = { method, args, request: { result: undefined, onsuccess: null, onerror: null } }
        if (store === null) waiting.push(operation)
        else run(operation)
        return operation.request
      }
      window.setTimeout(() => {
        const real = begin.call(this, stores, mode, options)
        real.oncomplete = () => facade.oncomplete?.()
        store = real.objectStore(typeof stores === "string" ? stores : (stores[0] ?? ""))
        for (const operation of waiting.splice(0)) run(operation)
      }, delay)
      return Object.assign(facade, {
        objectStore: () => ({
          getAll: (range: unknown) => queue("getAll", range),
          put: (value: unknown, key: unknown) => queue("put", value, key),
          delete: (key: unknown) => queue("delete", key),
        }),
      }) as unknown as IDBTransaction
    } as typeof IDBDatabase.prototype.transaction
  })
})

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function slowDevice(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.deviceDelay = 20_000
  })
}

async function openDeck(page: Page, file: string): Promise<string> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(file)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  return page.url()
}

async function unsavedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("airdesign:unsaved:")))
}

async function expectNothingUnsaved(page: Page): Promise<void> {
  await expect.poll(() => unsavedKeys(page)).toEqual([])
}

async function typeTitle(page: Page): Promise<void> {
  const editor = page.locator('[contenteditable="true"]')
  await expect(editor).toHaveText("Hello")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+a")
  await slowDevice(page)
  await editor.pressSequentially(typedTitle, { delay: 0 })
  await expect(editor).toHaveText(typedTitle)
}

test("text typed while the device write is slow is still there after an immediate reload", async ({ page }) => {
  await openDeck(page, clean)
  await typeTitle(page)
  await page.reload()
  await settled(page)
  await expect(page.locator('[contenteditable="true"]')).toHaveText(typedTitle)
  await expectNothingUnsaved(page)
})

test("text typed while the device write is slow is still there when the tab is closed and the deck is opened again", async ({
  page,
  context,
}) => {
  const address = await openDeck(page, clean)
  await typeTitle(page)
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto(address)
  await settled(reopened)
  await expect(reopened.locator('[contenteditable="true"]')).toHaveText(typedTitle)
  await expectNothingUnsaved(reopened)
})

test("a box moved while the device write is slow keeps its place after an immediate reload", async ({ page }) => {
  await openDeck(page, clean)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  await page.locator('[contenteditable="true"]').click()
  await slowDevice(page)
  const press = { x: Math.round(slide.x) + 300, y: Math.round(slide.y) + 150 }
  await page.mouse.move(press.x, press.y)
  await page.mouse.down()
  await page.mouse.move(press.x + 30, press.y + 60, { steps: 8 })
  await page.mouse.up()
  const frame = page.locator('[data-canvas-element="ppt/slides/slide1.xml#2"]')
  const placed = () =>
    frame.evaluate((box: HTMLElement) =>
      [box.style.left, box.style.top, box.style.width, box.style.height].map((each) => Number.parseFloat(each)),
    )
  expect(await placed()).toEqual([60, 90, 360, 120])
  await page.reload()
  await settled(page)
  const kept = await placed()
  ;[457_200 + 30 * emuPerPixel, 457_200 + 60 * emuPerPixel, 5_486_400, 1_828_800].forEach((emu, index) =>
    expect(kept[index]).toBeCloseTo(emu / emuPerPixel, 3),
  )
  await expectNothingUnsaved(page)
})

test("speaker notes typed while the device write is slow are still there after an immediate reload", async ({
  page,
}) => {
  await openDeck(page, notesDeck)
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  const field = page.getByRole("textbox", { name: "Speaker notes", exact: true })
  await expect(field).toBeEditable()
  await slowDevice(page)
  await field.fill(typedNotes)
  await page.reload()
  await settled(page)
  await page.getByRole("button", { name: "Expand speaker notes" }).first().click()
  await expect(page.getByRole("textbox", { name: "Speaker notes", exact: true })).toHaveValue(typedNotes)
  await expectNothingUnsaved(page)
})

test("a slide added while the device write is slow is still there after an immediate reload", async ({ page }) => {
  await page.goto("/")
  await newBlankDeck(page)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await slowDevice(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect.poll(() => unsavedKeys(page)).toHaveLength(1)
  await page.reload()
  await settled(page)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expectNothingUnsaved(page)
})
