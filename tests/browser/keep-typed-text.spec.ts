import { presentCopy } from "../../apps/web/src/copy/present-copy.ts"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { holdableDevice, slowDevice } from "./slow-device"
import { decksOn, test } from "./deck-test"

const fixtures = join(process.cwd(), "scripts/pptx-fixtures")
const clean = join(fixtures, "clean.pptx")
const notesDeck = join(fixtures, "nasa-1d-cnn.pptx")
const typedTitle = "Typed on a new slide"
const typedNotes = "Remember the result & the next step."
const emuPerPixel = 15_240

test.use({ viewport: { width: 1470, height: 923 } })

test.beforeEach(async ({ page }) => {
  await holdableDevice(page)
})

async function openDeck(page: Page, file: string): Promise<string> {
  await decksOn(page).open(file)
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
  await editor.dblclick()
  await page.keyboard.press("ControlOrMeta+a")
  await slowDevice(page)
  await editor.pressSequentially(typedTitle, { delay: 0 })
  await expect(editor).toHaveText(typedTitle)
}

test("text typed while the device write is slow is still there after an immediate reload", async ({ page, decks }) => {
  await openDeck(page, clean)
  await typeTitle(page)
  await page.reload()
  await decks.ready()
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
  await decksOn(reopened).ready()
  await expect(reopened.locator('[contenteditable="true"]')).toHaveText(typedTitle)
  await expectNothingUnsaved(reopened)
})

test("a box moved while the device write is slow keeps its place after an immediate reload", async ({
  page,
  decks,
}) => {
  await openDeck(page, clean)
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  if (slide === null) throw new Error("no slide")
  await page.locator('[contenteditable="true"]').click()
  await slowDevice(page)
  const press = { x: Math.round(slide.x) + 300, y: Math.round(slide.y) + 120 }
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
  await decks.ready()
  const kept = await placed()
  ;[457_200 + 30 * emuPerPixel, 457_200 + 60 * emuPerPixel, 5_486_400, 1_828_800].forEach((emu, index) =>
    expect(kept[index]).toBeCloseTo(emu / emuPerPixel, 3),
  )
  await expectNothingUnsaved(page)
})

test("speaker notes typed while the device write is slow are still there after an immediate reload", async ({
  page,
  decks,
}) => {
  await openDeck(page, notesDeck)
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  const field = page.getByRole("textbox", { name: presentCopy.notes, exact: true })
  await expect(field).toBeEditable()
  await slowDevice(page)
  await field.fill(typedNotes)
  await page.reload()
  await decks.ready()
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: presentCopy.notes, exact: true })).toHaveValue(typedNotes)
  await expectNothingUnsaved(page)
})

test("a slide added while the device write is slow is still there after an immediate reload", async ({
  page,
  decks,
}) => {
  await decks.blank()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(1)
  await slowDevice(page)
  await page.getByRole("button", { name: "Add slide" }).click()
  await expect.poll(() => unsavedKeys(page)).toHaveLength(1)
  await page.reload()
  await decks.ready()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await expectNothingUnsaved(page)
})
