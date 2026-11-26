import { expect, type Page } from "@playwright/test"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { landNodes, landOffScreen, openEditor, savedNode, savedSlides, type Opened } from "./editor-deck"
import { boxOf, card, entry, openGrid, viewport, wheelAt, zoomTo, type Box, type Point } from "./grid-deck"
import { layer, textOf, type Stack } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })
test.describe.configure({ mode: "parallel" })

const slideW = 1920
const slideH = 1080
const layerBox = { x: 200, y: 600, w: 800, h: 300 }
const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const outline = (page: Page) => live(page).locator("[data-selection-outline]")
const editor = (page: Page) => page.locator("[data-text-editor]")
const painted = (page: Page, id: string) => page.locator(`[data-editor-grid] [data-node="${id}"]`)

const zooms = ["fit", 30, 100, 250] as const
type Zoom = (typeof zooms)[number]

function zoomLabel(zoom: Zoom): string {
  return zoom === "fit" ? "fit" : `${String(zoom)}%`
}

async function twoSlides(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack) {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: layer("Hello grid") }])
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await openGrid(page)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(live(page)).toHaveCount(0)
  return opened
}

async function deck(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack): Promise<Opened> {
  const opened = await twoSlides(page, context, stack)
  const second = (await savedSlides(stack, opened))[1]
  if (second === undefined) throw new Error("no second slide")
  await landOffScreen(stack, opened, [{ id: "t:2", type: "shape", parent: second, props: layer("Second slide") }])
  await expect(painted(page, "t:1")).toBeVisible()
  await expect(painted(page, "t:2")).toBeVisible()
  return opened
}

async function savedBox(stack: Stack, opened: Opened, id: string): Promise<Point> {
  const box = (await savedNode(stack, opened, id))?.box as { x?: number; y?: number } | undefined
  return { x: box?.x ?? Number.NaN, y: box?.y ?? Number.NaN }
}

async function centreOf(target: ReturnType<typeof painted>): Promise<Point> {
  const box = await boxOf(target)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function panSlidePoint(page: Page, number: number, x: number, y: number): Promise<Point> {
  const room = await boxOf(viewport(page))
  const around = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  const frame = await boxOf(card(page, number))
  const at = { x: frame.x + (frame.width * x) / slideW, y: frame.y + (frame.height * y) / slideH }
  await wheelAt(page, around, { x: at.x - around.x, y: at.y - around.y })
  return around
}

function visibleOnLayer(frame: Box, room: Box): Point {
  const left = frame.x + (frame.width * layerBox.x) / slideW
  const top = frame.y + (frame.height * layerBox.y) / slideH
  const right = left + (frame.width * layerBox.w) / slideW
  const bottom = top + (frame.height * layerBox.h) / slideH
  const x1 = Math.max(left, room.x + 2)
  const y1 = Math.max(top, room.y + 2)
  const x2 = Math.min(right, room.x + room.width - 2)
  const y2 = Math.min(bottom, room.y + room.height - 2)
  if (x2 - x1 < 8 || y2 - y1 < 8) throw new Error("the layer is off screen")
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }
}

async function aim(page: Page, number: number, id: string, panned: boolean): Promise<Point> {
  if (!panned) return visibleOnLayer(await boxOf(card(page, number)), await boxOf(viewport(page)))
  const at = await panSlidePoint(page, number, layerBox.x + layerBox.w / 2, layerBox.y + layerBox.h / 2)
  await expect.poll(async () => (await centreOf(painted(page, id))).x).toBeCloseTo(at.x, 0)
  await expect.poll(async () => (await centreOf(painted(page, id))).y).toBeCloseTo(at.y, 0)
  return at
}

async function stillThenDrag(page: Page, stack: Stack, opened: Opened, number: number, id: string, panned: boolean) {
  const at = await aim(page, number, id, panned)
  const before = await boxOf(card(page, number))
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const during = await boxOf(card(page, number))
  expect(
    Math.abs(during.x - before.x) + Math.abs(during.y - before.y),
    `${id} moved its card on a press that did not move`,
  ).toBeLessThan(1)
  await page.mouse.up()
  await expect(outline(page), `${id} was missed`).toHaveAttribute("data-selection-outline", id)
  await expect
    .poll(async () => savedBox(stack, opened, id), { message: `${id} was written by a still click` })
    .toEqual({
      x: layerBox.x,
      y: layerBox.y,
    })
  const scale = (await boxOf(card(page, number))).width / slideW
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(at.x + 100, at.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Control")
  const moved = { x: layerBox.x + 100 / scale, y: layerBox.y }
  await expect
    .poll(async () => savedBox(stack, opened, id), { message: `${id} did not move by 100/scale` })
    .toMatchObject({ y: moved.y })
  await expect.poll(async () => (await savedBox(stack, opened, id)).x).toBeCloseTo(moved.x, 0)
}

for (const zoom of zooms) {
  for (const panned of [false, true]) {
    test(`a still click on the current slide at ${zoomLabel(zoom)} ${panned ? "after a pan" : "without panning"} writes nothing, and a 100px drag moves by 100/scale`, async ({
      page,
      context,
      stack,
    }) => {
      const opened = await deck(page, context, stack)
      if (zoom !== "fit") await zoomTo(page, zoom)
      await stillThenDrag(page, stack, opened, 2, "t:2", panned)
    })
  }
}

for (const zoom of zooms) {
  for (const panned of [false, true]) {
    if (!panned && zoom !== "fit" && zoom !== 30) continue
    test(`a still click on another slide at ${zoomLabel(zoom)} ${panned ? "after a pan" : "without panning"} writes nothing, and a 100px drag moves by 100/scale`, async ({
      page,
      context,
      stack,
    }) => {
      const opened = await deck(page, context, stack)
      if (zoom !== "fit") await zoomTo(page, zoom)
      await stillThenDrag(page, stack, opened, 1, "t:1", panned)
    })
  }
}

for (const zoom of zooms) {
  test(`the caret lands under the pointer after a pan at ${zoomLabel(zoom)}`, async ({ page, context, stack }) => {
    const opened = await deck(page, context, stack)
    const blank = await boxOf(card(page, 1))
    await page.mouse.click(blank.x + blank.width * 0.9, blank.y + blank.height * 0.9)
    await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
    await expect(live(page)).toHaveCount(0)
    if (zoom !== "fit") await zoomTo(page, zoom)
    await panSlidePoint(page, 1, 262, 636)
    const point = await painted(page, "t:1")
      .locator("[data-run]")
      .first()
      .evaluate((span) => {
        const text = span.firstChild
        if (text === null || text.textContent === null || text.textContent.length < 3) return null
        const range = document.createRange()
        range.setStart(text, 0)
        range.setEnd(text, 3)
        const box = range.getBoundingClientRect()
        return { x: box.right - 0.1, y: box.y + box.height / 2 }
      })
    if (point === null) throw new Error("no glyph")
    const before = await boxOf(card(page, 1))
    await page.mouse.dblclick(point.x, point.y)
    await expect(editor(page)).toBeFocused()
    const during = await boxOf(card(page, 1))
    expect(
      Math.abs(during.x - before.x) + Math.abs(during.y - before.y),
      "the card moved under the caret",
    ).toBeLessThan(1)
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const caret = await editor(page).evaluate((field) => {
      const selected = document.getSelection()
      if (selected === null || selected.rangeCount === 0 || !field.contains(selected.anchorNode)) return null
      const box = selected.getRangeAt(0).getClientRects()[0]
      return box === undefined ? null : { x: box.x, y: box.y + box.height / 2 }
    })
    expect(caret, "the caret left the pointer").not.toBeNull()
    expect(Math.hypot((caret?.x ?? 0) - point.x, (caret?.y ?? 0) - point.y)).toBeLessThan(4)
    await expect
      .poll(() =>
        editor(page).evaluate((field) => {
          const selected = document.getSelection()
          if (selected === null || selected.anchorNode === null || !selected.isCollapsed) return -1
          const range = document.createRange()
          range.selectNodeContents(field)
          range.setEnd(selected.anchorNode, selected.anchorOffset)
          return range.toString().length
        }),
      )
      .toBe(3)
    await page.keyboard.insertText("|")
    await page.keyboard.press("Escape")
    await expect.poll(async () => (await textOf(stack, opened))?.chars).toBe("Hel|lo grid")
  })
}

async function liveView(page: Page): Promise<{ x: number; y: number; scale: number }> {
  const raw = await page.locator("[data-editor-grid] [data-slide-list]").evaluate((node) => node.style.transform)
  const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(raw)
  if (match === null) throw new Error(`no grid transform: ${raw}`)
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) }
}

async function cameraRested(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const live = await liveView(page)
      const stored = await page.evaluate(
        () => Object.entries(localStorage).find(([key]) => key.startsWith("airdesign.grid-viewport."))?.[1] ?? "",
      )
      if (stored === "") return false
      const kept = JSON.parse(stored) as { x: number; y: number; scale: number }
      return (
        Math.abs(kept.x - live.x) < 0.01 &&
        Math.abs(kept.y - live.y) < 0.01 &&
        Math.abs(kept.scale - live.scale) < 0.00001
      )
    })
    .toBe(true)
}

async function pinch(page: Page, steps: number): Promise<number> {
  const room = await boxOf(viewport(page))
  const at = { x: room.x + room.width / 2, y: room.y + room.height / 2 }
  const before = (await boxOf(card(page, 2))).width / slideW
  for (let step = 0; step < steps; step += 1) await wheelAt(page, at, { x: 0, y: -10 }, { ctrlKey: true })
  const scale = (await boxOf(card(page, 2))).width / slideW
  expect(scale).toBeGreaterThan(before * 1.2)
  return scale
}

function mapped(frame: Box, box: { x: number; y: number; w: number; h: number }): Box {
  return {
    x: frame.x + (frame.width * box.x) / slideW,
    y: frame.y + (frame.height * box.y) / slideH,
    width: (frame.width * box.w) / slideW,
    height: (frame.height * box.h) / slideH,
  }
}

function near(actual: Box, expected: Box, px: number, label: string) {
  for (const key of ["x", "y", "width", "height"] as const)
    expect(Math.abs(actual[key] - expected[key]), `${label} ${key}`).toBeLessThan(px)
}

function sitsOn(frame: Box, layer: Box, screenScale: number) {
  const dx = frame.x + frame.width / 2 - (layer.x + layer.width / 2)
  const dy = frame.y + frame.height / 2 - (layer.y + layer.height / 2)
  expect(Math.hypot(dx, dy), "the selection frame left the layer").toBeLessThan(2)
  const stroke = screenScale * 4 + 2
  expect(Math.abs(frame.width - layer.width), "the selection frame is the wrong width").toBeLessThan(stroke)
  expect(Math.abs(frame.height - layer.height), "the selection frame is the wrong height").toBeLessThan(stroke)
}

test("a wheel zoom that has not settled selects the layer under the pointer and moves it by 100/scale", async ({
  page,
  context,
  stack,
}) => {
  const opened = await deck(page, context, stack)
  await zoomTo(page, 100)
  await aim(page, 2, "t:2", true)
  await cameraRested(page)
  await page.clock.install()

  await pinch(page, 4)
  const room = await boxOf(viewport(page))
  const hit = visibleOnLayer(await boxOf(card(page, 2)), room)
  await page.mouse.move(hit.x, hit.y)
  await page.mouse.down()
  await page.mouse.up()
  await expect(outline(page)).toHaveAttribute("data-selection-outline", "t:2")
  await expect.poll(async () => savedBox(stack, opened, "t:2")).toEqual({ x: layerBox.x, y: layerBox.y })

  const scale = await pinch(page, 4)
  const dragged = visibleOnLayer(await boxOf(card(page, 2)), room)
  await page.mouse.move(dragged.x, dragged.y)
  await page.mouse.down()
  await page.keyboard.down("Control")
  await page.mouse.move(dragged.x + 100, dragged.y, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up("Control")
  const moved = { x: layerBox.x + 100 / scale, y: layerBox.y }
  await expect.poll(async () => savedBox(stack, opened, "t:2")).toMatchObject({ y: moved.y })
  await expect.poll(async () => (await savedBox(stack, opened, "t:2")).x).toBeCloseTo(moved.x, 0)

  await pinch(page, 4)
  const frame = await boxOf(card(page, 2))
  const layer = await boxOf(painted(page, "t:2"))
  const saved = await savedBox(stack, opened, "t:2")
  near(layer, mapped(frame, { x: saved.x, y: saved.y, w: layerBox.w, h: layerBox.h }), 2, "painted layer")
  sitsOn(await boxOf(outline(page)), layer, frame.width / slideW)
})

test("a press that never moves writes nothing when the canvas scrolls under it", async ({ page, context, stack }) => {
  const opened = await deck(page, context, stack)
  await zoomTo(page, 100)
  const at = await aim(page, 2, "t:2", true)
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  const before = (await boxOf(card(page, 2))).y
  await page.mouse.wheel(0, 60)
  await expect.poll(async () => (await boxOf(card(page, 2))).y).toBeLessThan(before - 30)
  await page.mouse.up()
  await expect(outline(page)).toHaveAttribute("data-selection-outline", "t:2")
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)))
  expect(await savedBox(stack, opened, "t:2")).toEqual({ x: layerBox.x, y: layerBox.y })
})
