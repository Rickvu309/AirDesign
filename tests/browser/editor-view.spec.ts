import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { accent, clickSlide, landNodes, openEditor, spot } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const percentOf = (text: string | null) => Number.parseInt(text ?? "", 10)

test("zoom keys, the wheel and the hand tool move around the slide as Figma does", async ({ page, context, stack }) => {
  covers("zoom-fit", "zoom-actual", "zoom-in", "zoom-out", "zoom-selection", "tool-hand", "tool-move", "pan")
  await openEditor(page, context, stack)
  const percent = page.locator("[data-zoom-readout]")
  const slide = page.locator("[data-slide-box]")
  const fittedSlide = await slide.boundingBox()
  const fitted = percentOf(await percent.textContent())
  expect(fitted).toBeGreaterThan(40)
  expect(fitted).toBeLessThan(100)

  await page.keyboard.press("Shift+Digit0")
  await expect(percent).toHaveText(editorCopy.percent(100))
  await page.keyboard.press("Shift+Equal")
  await expect(percent).toHaveText(editorCopy.percent(150))
  await page.keyboard.press("Minus")
  await expect(percent).toHaveText(editorCopy.percent(100))
  await page.keyboard.press("Shift+Digit1")
  await expect(percent).toHaveText(editorCopy.percent(fitted))

  await clickSlide(page, 600, 490)
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => percentOf(await percent.textContent())).toBeGreaterThan(fitted)

  await page.keyboard.press("Shift+Digit0")
  const stage = page.locator("[data-editor-stage]")
  await expect(percent).toHaveText(editorCopy.percent(100))
  const beforePan = (await slide.boundingBox())!
  await page.getByRole("button", { name: editorCopy.moveTools }).click()
  await page.getByRole("menuitem", { name: new RegExp(editorCopy.toolHand) }).click()
  const room = await stage.boundingBox()
  await page.mouse.move((room?.x ?? 0) + 600, (room?.y ?? 0) + 300)
  await page.mouse.down()
  await page.mouse.move((room?.x ?? 0) + 500, (room?.y ?? 0) + 300, { steps: 4 })
  await page.mouse.up()
  expect(await slide.boundingBox()).toEqual({ ...beforePan, x: beforePan.x - 100 })
  await page.keyboard.press("v")
  await expect(page.getByRole("button", { name: editorCopy.toolMove, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )

  await page.keyboard.press("Shift+Digit1")
  const before = (await slide.boundingBox())!
  expect(before).toEqual(fittedSlide)
  const x = Math.round(before.x + before.width * 0.6)
  const y = Math.round(before.y + before.height * 0.6)
  await page.keyboard.down("ControlOrMeta")
  await page.mouse.move(x, y)
  await page.mouse.wheel(0, -200)
  await page.keyboard.up("ControlOrMeta")
  await expect.poll(async () => percentOf(await percent.textContent())).toBeGreaterThan(fitted)
  const after = (await slide.boundingBox())!
  const ratio = after.width / before.width
  expect(Math.abs(after.x + (x - before.x) * ratio - x)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.y + (y - before.y) * ratio - y)).toBeLessThanOrEqual(1)
})

test("every pan gesture moves a fitted slide and Fit recentres it", async ({ page, context, stack }) => {
  await openEditor(page, context, stack)
  const slide = page.locator("[data-slide-box]")
  const stage = (await page.locator("[data-canvas-stage]").boundingBox())!
  const overlay = (await page.locator("[data-canvas-overlay]:not(svg)").boundingBox())!
  const before = (await slide.boundingBox())!
  const x = before.x + before.width / 2
  const y = before.y + before.height / 2
  expect(Math.abs(x - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1)
  expect(Math.abs(y - (stage.y + overlay.y) / 2)).toBeLessThanOrEqual(1)

  async function drag(button: "left" | "middle", dx: number, dy: number) {
    await page.mouse.move(x, y)
    await page.mouse.down({ button })
    await page.mouse.move(x + dx, y + dy, { steps: 4 })
    await page.mouse.up({ button })
    expect(await slide.boundingBox()).toEqual({ ...before, x: before.x + dx, y: before.y + dy })
    await page.keyboard.press("Shift+Digit1")
    expect(await slide.boundingBox()).toEqual(before)
  }

  await page.keyboard.press("h")
  await drag("left", 100, 60)
  await page.keyboard.press("v")
  await drag("middle", -100, -60)
  await page.keyboard.down(shortcutCopy.keyNames.Space)
  await drag("left", -100, 60)
  await page.keyboard.up(shortcutCopy.keyNames.Space)

  await page.mouse.move(x, y)
  await page.mouse.wheel(100, 60)
  await expect.poll(() => slide.boundingBox()).toEqual({ ...before, x: before.x - 100, y: before.y - 60 })
  await page.keyboard.press("Shift+Digit1")
  expect(await slide.boundingBox()).toEqual(before)
})

test("actual size asked before the grown viewport is measured still centres the slide", async ({
  page,
  context,
  stack,
}) => {
  await page.addInitScript(() => {
    const Observer = window.ResizeObserver
    window.ResizeObserver = class extends Observer {
      constructor(report: ResizeObserverCallback) {
        super((entries, observer) => setTimeout(() => report(entries, observer), 400))
      }
    }
  })
  await page.setViewportSize({ width: 1470, height: 923 })
  await openEditor(page, context, stack)
  await clickSlide(page, 50, 50)
  const stage = page.locator("[data-editor-stage]")
  const slide = page.locator("[data-slide-box]")

  await page.setViewportSize({ width: 2700, height: 1340 })
  await stage.focus()
  await page.keyboard.press("Shift+Digit0")
  await expect(page.locator("[data-zoom-readout]")).toHaveText(editorCopy.percent(100))

  const box = (await slide.boundingBox())!
  const viewport = (await stage.boundingBox())!
  expect(box.width).toBe(1920)
  expect(Math.abs(box.x + box.width / 2 - (viewport.x + viewport.width / 2))).toBeLessThanOrEqual(1)
})

test("zoom to selection centres slide-edge layers, including at the same zoom", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "z:1", type: "shape", parent: opened.slide, props: { box: spot(10, 10, 90, 90), fills: accent } },
    { id: "z:2", type: "shape", parent: opened.slide, props: { box: spot(110, 10, 90, 90), fills: accent } },
  ])
  const percent = page.locator("[data-zoom-readout]")
  const stage = (await page.locator("[data-canvas-stage]").boundingBox())!
  const overlay = (await page.locator("[data-canvas-overlay]:not(svg)").boundingBox())!
  for (const { id, x } of [
    { id: "z:1", x: 55 },
    { id: "z:2", x: 155 },
  ]) {
    await clickSlide(page, x, 55)
    await page.keyboard.press("Shift+Digit2")
    await expect(percent).toHaveText(editorCopy.percent(400))
    const outline = (await page.locator(`[data-selection-outline="${id}"]`).boundingBox())!
    expect(Math.abs(outline.x + outline.width / 2 - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(outline.y + outline.height / 2 - (stage.y + overlay.y) / 2)).toBeLessThanOrEqual(1)
  }
})

test("zoom to selection keeps the bottom handles clear of the notes overlay", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "z:3", type: "shape", parent: opened.slide, props: { box: spot(900, 260, 200, 560), fills: accent } },
  ])
  await clickSlide(page, 1000, 540)
  const outline = page.locator('[data-selection-outline="z:3"]')
  const before = await outline.boundingBox()
  await page.keyboard.press("Shift+Digit2")
  const after = await outline.boundingBox()
  const overlay = await page.locator("[data-canvas-overlay]:not(svg)").boundingBox()
  expect(after!.height).toBeGreaterThan(before!.height)
  expect(after!.y + after!.height).toBeLessThanOrEqual(overlay!.y)
})
