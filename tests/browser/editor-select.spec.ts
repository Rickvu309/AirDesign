import { expect } from "@playwright/test"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  accent,
  clearSubtitle,
  clickSlide,
  dragSlide,
  landNodes,
  openEditor,
  savedNode,
  selectedIds,
  slidePoint,
  spot,
} from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const shift = shortcutCopy.chord.other.shift

async function withLayers(
  page: Parameters<typeof openEditor>[0],
  context: Parameters<typeof openEditor>[1],
  stack: Parameters<typeof openEditor>[2],
) {
  const opened = await openEditor(page, context, stack)
  const slide = opened.slide
  await clearSubtitle(stack, opened)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: slide, props: { box: spot(100, 700, 200, 120), fills: accent } },
    { id: "t:2", type: "frame", parent: slide, props: { box: spot(600, 700, 500, 200) } },
    { id: "t:3", type: "shape", parent: "t:2", props: { box: spot(0, 0, 200, 200), fills: accent } },
    { id: "t:4", type: "shape", parent: "t:2", props: { box: spot(300, 0, 200, 200), fills: accent } },
    { id: "t:5", type: "frame", parent: slide, props: { box: spot(1300, 650, 400, 300), fills: accent } },
    { id: "t:6", type: "shape", parent: "t:5", props: { box: spot(50, 50, 100, 100), fills: accent } },
    { id: "t:7", type: "shape", parent: slide, props: { box: spot(100, 100, 200, 200), fills: accent, locked: true } },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(8)
  return opened
}

test("a click takes a group whole, a double-click steps into it, and Shift-Enter and Escape step back out", async ({
  page,
  context,
  stack,
}) => {
  covers("select", "step-in", "select-parent", "deselect")
  await withLayers(page, context, stack)
  await clickSlide(page, 700, 800)
  expect(await selectedIds(page)).toEqual(["t:2"])
  await clickSlide(page, 700, 800, { double: true })
  expect(await selectedIds(page)).toEqual(["t:3"])
  await clickSlide(page, 1000, 800)
  expect(await selectedIds(page)).toEqual(["t:4"])
  await page.keyboard.press("Shift+Enter")
  expect(await selectedIds(page)).toEqual(["t:2"])
  await page.keyboard.press("Escape")
  expect(await selectedIds(page)).toEqual([])
})

test("Enter selects an unlocked child one level down and still edits text", async ({ page, context, stack }) => {
  covers("step-in", "edit-text")
  const opened = await openEditor(page, context, stack)
  await clearSubtitle(stack, opened)
  const text = { chars: "A child layer", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" }
  await landNodes(stack, opened, [
    { id: "k:1", type: "frame", parent: opened.slide, props: { box: spot(600, 600, 720, 200) } },
    { id: "k:2", type: "shape", parent: "k:1", props: { box: spot(0, 0, 200, 72), locked: true } },
    { id: "k:3", type: "frame", parent: "k:1", props: { box: spot(300, 0, 200, 100) } },
    { id: "k:4", type: "shape", parent: "k:3", props: { box: spot(0, 0, 200, 72), text } },
  ])
  await clickSlide(page, 960, 636)
  expect(await selectedIds(page)).toEqual(["k:1"])
  await page.keyboard.press(shortcutCopy.keyNames.Enter)
  expect(await selectedIds(page)).toEqual(["k:3"])
  await page.keyboard.press(shortcutCopy.keyNames.Enter)
  expect(await selectedIds(page)).toEqual(["k:4"])
  await page.keyboard.press(shortcutCopy.keyNames.Enter)
  await expect(page.locator("[data-text-editor]")).toBeFocused()
})

test("Enter on a focused Add slide button adds a slide and steps into no layer", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await clearSubtitle(stack, opened)
  await landNodes(stack, opened, [
    { id: "k:1", type: "frame", parent: opened.slide, props: { box: spot(600, 600, 720, 200) } },
    { id: "k:2", type: "shape", parent: "k:1", props: { box: spot(0, 0, 200, 72), fills: accent } },
  ])
  await clickSlide(page, 700, 636)
  expect(await selectedIds(page)).toEqual(["k:1"])
  await page.getByRole("button", { name: slideListCopy.addSlide }).focus()
  await page.keyboard.press(shortcutCopy.keyNames.Enter)
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  expect(await selectedIds(page)).not.toEqual(["k:2"])
})

test("Shift adds a layer, Cmd or Ctrl reaches inside a frame, and a locked layer passes the click through", async ({
  page,
  context,
  stack,
}) => {
  covers("select-add", "deep-select", "select-all")
  await withLayers(page, context, stack)
  await clickSlide(page, 200, 750)
  await page.keyboard.down(shift)
  await clickSlide(page, 1650, 900)
  await page.keyboard.up(shift)
  expect(await selectedIds(page)).toEqual(["t:1", "t:5"])
  await page.keyboard.down(shift)
  await clickSlide(page, 200, 750)
  await page.keyboard.up(shift)
  expect(await selectedIds(page)).toEqual(["t:5"])
  await page.keyboard.down("ControlOrMeta")
  await clickSlide(page, 1400, 750)
  await page.keyboard.up("ControlOrMeta")
  expect(await selectedIds(page)).toEqual(["t:6"])
  await clickSlide(page, 200, 200)
  expect(await selectedIds(page)).toEqual([])
  await page.keyboard.press("ControlOrMeta+a")
  expect(await selectedIds(page)).toEqual(["s:4", "t:1", "t:2", "t:5"])
})

test("a marquee takes every layer it touches, Shift adds to it, and moving a group moves what is inside it", async ({
  page,
  context,
  stack,
}) => {
  covers("marquee", "move")
  const opened = await withLayers(page, context, stack)
  await dragSlide(page, { x: 40, y: 600 }, { x: 1200, y: 990 })
  expect(await selectedIds(page)).toEqual(["t:1", "t:2"])
  await page.keyboard.down(shift)
  await dragSlide(page, { x: 1250, y: 600 }, { x: 1800, y: 1000 })
  await page.keyboard.up(shift)
  expect(await selectedIds(page)).toEqual(["t:1", "t:2", "t:5"])

  await clickSlide(page, 1000, 800)
  await clickSlide(page, 700, 800)
  await dragSlide(page, { x: 700, y: 800 }, { x: 700, y: 760 })
  await expect
    .poll(async () => ((await savedNode(stack, opened, "t:2"))?.box as { y: number } | undefined)?.y)
    .toBeLessThan(680)
  const inside = (await savedNode(stack, opened, "t:3"))?.box
  expect(inside).toMatchObject(spot(0, 0, 200, 200))
})

test("the hover outline goes when the pointer leaves the canvas before the browser hovers what replaced the text editor", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const text = { chars: "A card line", spans: [], paras: [{}], style: "body", resize: "fixed", alignV: "top" }
  await landNodes(stack, opened, [
    { id: "t:0", type: "frame", parent: opened.slide, props: { box: spot(600, 600, 720, 200) } },
    { id: "t:1", type: "shape", parent: "t:0", props: { box: spot(0, 0, 720, 72), text } },
  ])
  const hover = page.locator("[data-hover-outline]")
  const editor = page.locator("[data-text-editor]")
  await clickSlide(page, 960, 636, { double: true })
  expect(await selectedIds(page)).toEqual(["t:1"])
  await expect(hover).toBeAttached()
  await page.keyboard.press("Enter")
  await expect(editor).toBeFocused()

  let closed = () => {}
  const editorClosed = new Promise<void>((resolve) => {
    closed = resolve
  })
  await page.exposeFunction("editorClosedUnderPointer", () => closed())
  const heldUntilPointerLeft = editor.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }))
    void (window as unknown as { editorClosedUnderPointer: () => Promise<void> }).editorClosedUnderPointer()
    const until = performance.now() + 500
    while (performance.now() < until);
  })
  await editorClosed
  await page.mouse.move(4, 4)
  await heldUntilPointerLeft
  await expect(editor).toHaveCount(0)
  await expect(hover).toHaveCount(0)
})

test("the Hand gesture clears hover and Move restores it at the pointer", async ({ page, context, stack }) => {
  await withLayers(page, context, stack)
  const hover = page.locator("[data-hover-outline]")
  const first = await slidePoint(page, 200, 750)
  const second = await slidePoint(page, 1400, 750)
  await page.mouse.move(first.x, first.y)
  await expect(hover).toBeAttached()
  await page.keyboard.down(shortcutCopy.keyNames.Space)
  await expect(hover).toHaveCount(0)
  await page.mouse.move(second.x, second.y)
  await page.mouse.down()
  await page.mouse.move(second.x - 100, second.y - 60)
  await page.mouse.up()
  await expect(hover).toHaveCount(0)
  await page.keyboard.up(shortcutCopy.keyNames.Space)
  await expect(hover).toBeAttached()
  const frame = await slidePoint(page, 1500, 800)
  const bounds = await hover.boundingBox()
  expect(bounds!.x + bounds!.width / 2).toBeCloseTo(frame.x, 1)
  expect(bounds!.y + bounds!.height / 2).toBeCloseTo(frame.y, 1)
})
