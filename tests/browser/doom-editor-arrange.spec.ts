import { expect, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { frameCopy } from "../../apps/web/src/copy/frame-copy"
import { shortcutCopy } from "../../apps/web/src/copy/shortcut-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  accent,
  clearSubtitle,
  clickSlide,
  landNodes,
  openDoomEditor,
  savedNode,
  selectedIds,
  spot,
  type Opened,
} from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const shift = shortcutCopy.chord.other.shift

type Stack = Parameters<typeof savedNode>[0]
type Saved = { x: number; y: number; w: number; h: number; flipH: boolean }

async function threeBoxes(page: Page, context: Parameters<typeof openDoomEditor>[1], stack: Stack) {
  const opened = await openDoomEditor(page, context, stack as Parameters<typeof openDoomEditor>[2])
  await clearSubtitle(stack, opened)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(100, 700, 200, 120), fills: accent } },
    { id: "t:2", type: "shape", parent: opened.slide, props: { box: spot(600, 700, 200, 120), fills: accent } },
    { id: "t:3", type: "shape", parent: opened.slide, props: { box: spot(1100, 700, 200, 120), fills: accent } },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(4)
  return opened
}

const keyOf = async (stack: Stack, opened: Opened, id: string) =>
  ((await savedNode(stack, opened, id))?.parent as { at: string } | undefined)?.at ?? ""

const shapeCount = (page: Page) => page.locator("[data-slide-box] [data-node]").count()

test("Ctrl+D copies in place and selects the copy, Ctrl+C then Ctrl+V pastes another, and one undo takes a copy away", async ({
  page,
  context,
  stack,
}) => {
  covers("duplicate", "copy", "paste", "undo")
  await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.press("ControlOrMeta+d")
  await expect.poll(() => shapeCount(page)).toBe(5)
  const [copy] = await selectedIds(page)
  expect(copy).not.toBe("t:1")
  await page.keyboard.press("ControlOrMeta+c")
  await page.keyboard.press("ControlOrMeta+v")
  await expect.poll(() => shapeCount(page)).toBe(6)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => shapeCount(page)).toBe(5)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => shapeCount(page)).toBe(4)
})

test("Ctrl+G groups, Ctrl+Shift+G ungroups, and Ctrl+Alt+G frames what is selected", async ({
  page,
  context,
  stack,
}) => {
  covers("select-add")
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.down(shift)
  await clickSlide(page, 700, 760)
  await page.keyboard.up(shift)
  await page.keyboard.press("ControlOrMeta+g")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const [group] = await selectedIds(page)
  await expect.poll(async () => (await savedNode(stack, opened, group ?? ""))?.name).toBe(shortcutCopy.gestures.group)
  const saved = await savedNode(stack, opened, group ?? "")
  expect(saved?.box).toMatchObject({ x: 100, y: 700, w: 700, h: 120 })
  expect(saved?.sizing).toEqual({ w: "hug", h: "hug" })
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 500, y: 0 })

  await page.keyboard.press("ControlOrMeta+Shift+g")
  await expect.poll(async () => ((await savedNode(stack, opened, "t:2"))?.box as Saved).x).toBe(600)
  expect((await savedNode(stack, opened, "t:1"))?.box).toMatchObject({ x: 100, y: 700 })
  expect((await savedNode(stack, opened, group ?? ""))?.parent).toBeNull()
  expect(await selectedIds(page)).toEqual(["t:1", "t:2"])

  await page.keyboard.press("ControlOrMeta+Alt+g")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const [frame] = await selectedIds(page)
  await expect.poll(async () => (await savedNode(stack, opened, frame ?? ""))?.name).toBe(frameCopy.frame)
  expect((await savedNode(stack, opened, frame ?? ""))?.clip).toBe(true)
})

test("the bracket keys move a layer forward, backward, to the front and to the back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  const above = async (one: string, two: string) =>
    (await keyOf(stack, opened, one)) > (await keyOf(stack, opened, two))
  await page.keyboard.press("BracketRight")
  await expect.poll(() => above("t:1", "t:3")).toBe(true)
  await page.keyboard.press("BracketLeft")
  await expect.poll(() => above("t:1", "t:2")).toBe(false)
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(() => above("t:1", "t:2")).toBe(true)
  expect(await above("t:1", "t:3")).toBe(false)
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect.poll(() => above("t:1", "t:2")).toBe(false)
})

test("Shift+H flips a layer, and Ctrl+Shift+H hides and Ctrl+Shift+L locks it", async ({ page, context, stack }) => {
  covers("flip-horizontal", "hide", "lock")
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.press("Shift+h")
  await expect.poll(async () => ((await savedNode(stack, opened, "t:1"))?.box as Saved).flipH).toBe(true)
  await page.keyboard.press("ControlOrMeta+Shift+l")
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.locked).toBe(true)
  await page.keyboard.press("Escape")
  await clickSlide(page, 200, 760)
  expect(await selectedIds(page)).toEqual([])
  await clickSlide(page, 700, 760)
  await page.keyboard.press("ControlOrMeta+Shift+h")
  await expect.poll(async () => (await savedNode(stack, opened, "t:2"))?.hidden).toBe(true)
  await expect.poll(() => shapeCount(page)).toBe(3)
})

test("the slide panel counts hidden and locked layers, and Show all and Unlock all bring them back as one undo each", async ({
  page,
  context,
  stack,
}) => {
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.press("ControlOrMeta+Shift+h")
  await page.keyboard.press("Escape")
  await clickSlide(page, 700, 760)
  await page.keyboard.press("ControlOrMeta+Shift+h")
  await page.keyboard.press("Escape")
  await clickSlide(page, 1200, 760)
  await page.keyboard.press("ControlOrMeta+Shift+l")
  await page.keyboard.press("Escape")
  await expect.poll(() => shapeCount(page)).toBe(2)

  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  const panel = page.locator("[data-design-panel]")
  const hidden = panel.locator('[data-held="hidden"]')
  const locked = panel.locator('[data-held="locked"]')
  await expect(hidden).toContainText(designCopy.heldLayers.hidden(2))
  await expect(locked).toContainText(designCopy.heldLayers.locked(1))

  await hidden.getByRole("button", { name: designCopy.heldLayersBack.hidden }).click()
  await expect.poll(() => shapeCount(page)).toBe(4)
  await expect(hidden).toHaveCount(0)
  await expect.poll(async () => (await savedNode(stack, opened, "t:2"))?.hidden ?? false).toBe(false)
  await page.locator("[data-doom-stage]").click({ position: { x: 20, y: 20 } })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => shapeCount(page)).toBe(2)
  await expect(hidden).toContainText(designCopy.heldLayers.hidden(2))
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(() => shapeCount(page)).toBe(4)

  await locked.getByRole("button", { name: designCopy.heldLayersBack.locked }).click()
  await expect(panel.locator("[data-held-layers]")).toHaveCount(0)
  await expect.poll(async () => (await savedNode(stack, opened, "t:3"))?.locked ?? false).toBe(false)
  await clickSlide(page, 1200, 760)
  expect(await selectedIds(page)).toEqual(["t:3"])
})
