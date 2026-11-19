import { join } from "node:path"
import { expect, test, type Page } from "@playwright/test"
import { covers } from "./gesture"

const clean = join(process.cwd(), "scripts/pptx-fixtures/clean.pptx")
const slideWide = 12_192_000
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const layerMiddle = { x: (start.x + start.cx / 2) / slideWide, y: (start.y + start.cy / 2) / 6_858_000 }

test.use({ viewport: { width: 1470, height: 923 }, reducedMotion: "reduce" })

type Row = { property?: string; value: unknown; node?: string }

async function openClean(page: Page): Promise<void> {
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(clean)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.waitForFunction(() => {
    const deck = location.pathname.match(/^\/deck\/([A-Za-z0-9_-]{1,64})$/)?.[1]
    return deck !== undefined && document.querySelector(".thin-page")?.getAttribute("data-deck-ready") === deck
  })
}

async function boxes(page: Page): Promise<{ x: number; y: number }[]> {
  const rows = await page.evaluate(
    () =>
      new Promise<Row[]>((resolve, reject) => {
        const request = indexedDB.open("airdesign")
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const all = request.result.transaction("rows", "readonly").objectStore("rows").getAll()
          all.onerror = () => reject(all.error)
          all.onsuccess = () => {
            request.result.close()
            resolve((all.result as unknown[]).filter((row) => typeof row === "object" && row !== null) as Row[])
          }
        }
      }),
  )
  return rows.filter((row) => row.property === "box").map((row) => row.value as { x: number; y: number })
}

async function slideBox(page: Page) {
  const box = await page.locator("[data-slide-paint]").boundingBox()
  if (box === null) throw new Error("no slide")
  return box
}

async function percent(page: Page): Promise<number> {
  return Number.parseFloat((await page.locator("[data-zoom-readout]").textContent()) ?? "")
}

async function scrolled(page: Page) {
  return page.locator("[data-canvas-stage]").evaluate((stage) => ({ left: stage.scrollLeft, top: stage.scrollTop }))
}

async function shown(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-canvas-stage]")?.getBoundingClientRect()
    const overlay = document.querySelector("[data-canvas-overlay]")?.getBoundingClientRect()
    const frame = document.querySelector("[data-selection]")?.getBoundingClientRect()
    if (!stage || !overlay || !frame) throw new Error("Canvas is not ready")
    return {
      view: { x: stage.left + stage.width / 2, y: stage.top + (overlay.top - stage.top) / 2 },
      frame: { x: frame.left + frame.width / 2, y: frame.top + frame.height / 2, width: frame.width },
      room: stage.width,
    }
  })
}

async function zoomWheel(page: Page, at: { x: number; y: number }, turns: number, delta = -100) {
  await page.mouse.move(at.x, at.y)
  await page.keyboard.down("Control")
  for (let turn = 0; turn < turns; turn++) await page.mouse.wheel(0, delta)
  await page.keyboard.up("Control")
}

test("Ctrl+scroll zooms about the layer under the cursor, Space pans, Shift+2 and Shift+1 fit, and a drag lands under the pointer", async ({
  page,
}) => {
  covers("pan", "zoom-selection", "zoom-fit", "zoom-100")
  await openClean(page)
  const fit = await percent(page)
  const before = await slideBox(page)
  const cursor = {
    x: Math.round(before.x + layerMiddle.x * before.width),
    y: Math.round(before.y + layerMiddle.y * before.height),
  }
  await zoomWheel(page, cursor, 5)
  await expect.poll(() => percent(page)).toBeGreaterThan(fit * 1.5)
  await expect.poll(async () => (await slideBox(page)).width).toBeGreaterThan(before.width * 1.5)
  const zoomed = await slideBox(page)
  expect(Math.abs(zoomed.x + layerMiddle.x * zoomed.width - cursor.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(zoomed.y + layerMiddle.y * zoomed.height - cursor.y)).toBeLessThanOrEqual(1)
  await expect(page.locator("[data-canvas-stage] > div")).toHaveAttribute("style", /^(?!.*transform)/)
  const notes = await page.evaluate(() => {
    const canvas = document.querySelector("[data-editor-canvas]")?.getBoundingClientRect()
    const bar = document.querySelector("[data-notes-bar]")?.getBoundingClientRect()
    return canvas && bar ? { left: bar.left - canvas.left, right: canvas.right - bar.right } : null
  })
  expect(notes?.left).toBeGreaterThanOrEqual(0)
  expect(notes?.right).toBeGreaterThanOrEqual(0)

  const panFrom = await scrolled(page)
  await page.keyboard.down("Space")
  await expect(page.locator("[data-hand-pan]")).toBeVisible()
  await page.mouse.move(cursor.x, cursor.y)
  await page.mouse.down()
  await page.mouse.move(cursor.x - 120, cursor.y - 60, { steps: 6 })
  await page.mouse.up()
  await page.keyboard.up("Space")
  await expect(page.locator("[data-hand-pan]")).toHaveCount(0)
  const panTo = await scrolled(page)
  expect(Math.round(panTo.left - panFrom.left)).toBe(120)
  expect(Math.round(panTo.top - panFrom.top)).toBe(60)
  expect(await boxes(page)).toEqual([])
  await expect(page.locator("[data-selection]")).toHaveCount(0)

  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-selection]")).toHaveCount(1)
  await page.keyboard.press("Shift+Digit2")
  await expect
    .poll(async () => {
      const now = await shown(page)
      return Math.round(now.room - now.frame.width)
    })
    .toBeLessThanOrEqual(100)
  const fitted = await shown(page)
  expect(Math.abs(fitted.frame.x - fitted.view.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(fitted.frame.y - fitted.view.y)).toBeLessThanOrEqual(1)
  expect(fitted.frame.width).toBeGreaterThan(fitted.room - 96 - 4)

  await page.keyboard.press("Shift+Digit0")
  await expect.poll(() => percent(page)).toBe(100)
  await page.keyboard.press("Shift+Digit1")
  await expect.poll(() => percent(page)).toBe(fit)
  expect((await slideBox(page)).width).toBe(before.width)

  await zoomWheel(page, cursor, 3)
  await expect.poll(() => percent(page)).toBeGreaterThan(fit)
  await expect(page.locator("[data-canvas-stage] > div")).toHaveAttribute("style", /^(?!.*transform)/)
  const slide = await slideBox(page)
  const grip = { x: slide.x + slide.width * 0.3, y: slide.y + (slide.height * (start.y + start.cy)) / 6_858_000 }
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 40, grip.y + 70, { steps: 8 })
  await page.mouse.up()
  const perPixel = slideWide / slide.width
  await expect.poll(async () => (await boxes(page)).length).toBe(1)
  const [moved] = await boxes(page)
  expect(Math.abs((moved?.x ?? 0) - (start.x + 40 * perPixel))).toBeLessThanOrEqual(perPixel)
  expect(Math.abs((moved?.y ?? 0) - (start.y + 70 * perPixel))).toBeLessThanOrEqual(perPixel)
})

test("Space types a space while editing text and does not pan", async ({ page }) => {
  await openClean(page)
  const text = page.locator('[contenteditable="true"]')
  await text.click()
  await page.keyboard.press("End")
  await page.keyboard.down("Space")
  await expect(page.locator("[data-hand-pan]")).toHaveCount(0)
  await page.keyboard.up("Space")
  await page.keyboard.type("x")
  await expect(text).toHaveText("Hello x")
})

test("a pinch keeps the slide laid out until the gesture rests, then lays it out once at the new zoom", async ({
  page,
}) => {
  await openClean(page)
  const fit = await percent(page)
  const before = await slideBox(page)
  const at = { x: before.x + before.width / 2, y: before.y + before.height / 2 }
  await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>("[data-slide-wrapper]")
    const widths: string[] = []
    Object.assign(window, { laidWidths: widths })
    if (wrapper !== null)
      new MutationObserver(() => widths.push(wrapper.style.width)).observe(wrapper, {
        attributes: true,
        attributeFilter: ["style"],
      })
  })
  await page.evaluate((point) => {
    const target = document.elementFromPoint(point.x, point.y)
    for (let event = 0; event < 12; event++)
      target?.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -8,
          ctrlKey: true,
          clientX: point.x,
          clientY: point.y,
          bubbles: true,
          cancelable: true,
        }),
      )
  }, at)
  await expect.poll(() => percent(page)).toBeGreaterThan(fit)
  const laid = await page.evaluate(() => (window as unknown as { laidWidths: string[] }).laidWidths)
  expect(laid).toEqual([`${String((await slideBox(page)).width)}px`])
})
