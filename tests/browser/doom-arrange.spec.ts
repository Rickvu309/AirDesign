import { expect, type Page } from "@playwright/test"
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
type Box = { x: number; y: number; w: number; h: number }
type Parent = { id: string; at: string } | null

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

const parentOf = async (stack: Stack, opened: Opened, id: string) =>
  (await savedNode(stack, opened, id))?.parent as Parent | undefined

async function stacking(stack: Stack, opened: Opened): Promise<readonly string[]> {
  const entries = await Promise.all(
    ["t:1", "t:2", "t:3"].map(async (id) => ({ id, at: (await parentOf(stack, opened, id))?.at ?? "" })),
  )
  return entries.sort((a, b) => (a.at < b.at ? -1 : 1)).map((entry) => entry.id)
}

const shapeCount = (page: Page) => page.locator("[data-slide-box] [data-node]").count()

test("Ctrl+] and Ctrl+[ step a layer one place, ] and [ send it to the front and the back", async ({
  page,
  context,
  stack,
}) => {
  covers("front", "forward", "backward", "back")
  const opened = await threeBoxes(page, context, stack)
  expect(await stacking(stack, opened)).toEqual(["t:1", "t:2", "t:3"])
  await clickSlide(page, 200, 760)
  expect(await selectedIds(page)).toEqual(["t:1"])

  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:1", "t:3"])
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:3", "t:1"])
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:1", "t:3"])
  await page.keyboard.press("BracketRight")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:3", "t:1"])
  await page.keyboard.press("BracketLeft")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:1", "t:2", "t:3"])
  expect(await selectedIds(page)).toEqual(["t:1"])

  await page.keyboard.press("ControlOrMeta+Shift+BracketRight")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:3", "t:1"])
  await page.keyboard.press("ControlOrMeta+Shift+BracketLeft")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:1", "t:2", "t:3"])

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => stacking(stack, opened)).toEqual(["t:2", "t:3", "t:1"])
})

test("Ctrl+G groups two layers, Ctrl+Shift+G ungroups them and Ctrl+Backspace ungroups a second group", async ({
  page,
  context,
  stack,
}) => {
  covers("group", "ungroup")
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.down(shift)
  await clickSlide(page, 700, 760)
  await page.keyboard.up(shift)
  await page.keyboard.press("ControlOrMeta+g")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const [group] = await selectedIds(page)
  await expect.poll(async () => (await savedNode(stack, opened, group ?? ""))?.name).toBe(shortcutCopy.gestures.group)
  const grouped = await savedNode(stack, opened, group ?? "")
  expect(grouped?.box).toMatchObject({ x: 100, y: 700, w: 700, h: 120 })
  expect((await parentOf(stack, opened, "t:1"))?.id).toBe(group)
  expect((await parentOf(stack, opened, "t:2"))?.id).toBe(group)
  expect((await parentOf(stack, opened, "t:3"))?.id).toBe(opened.slide)
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 500, y: 0 })

  await page.keyboard.press("ControlOrMeta+Shift+g")
  await expect.poll(async () => (await parentOf(stack, opened, "t:2"))?.id).toBe(opened.slide)
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 600, y: 700 })
  expect((await savedNode(stack, opened, "t:1"))?.box).toMatchObject({ x: 100, y: 700 })
  expect((await savedNode(stack, opened, group ?? ""))?.parent).toBeNull()
  expect(await selectedIds(page)).toEqual(["t:1", "t:2"])

  await page.keyboard.press("ControlOrMeta+g")
  await expect.poll(async () => (await parentOf(stack, opened, "t:1"))?.id).not.toBe(opened.slide)
  await page.keyboard.press("ControlOrMeta+Backspace")
  await expect.poll(async () => (await parentOf(stack, opened, "t:1"))?.id).toBe(opened.slide)
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 600, y: 700 })
})

test("Ctrl+Z after an ungroup brings the group back, and a second Ctrl+Z takes the group away", async ({
  page,
  context,
  stack,
}) => {
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 200, 760)
  await page.keyboard.down(shift)
  await clickSlide(page, 700, 760)
  await page.keyboard.up(shift)
  await page.keyboard.press("ControlOrMeta+g")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const [group = ""] = await selectedIds(page)
  await expect.poll(async () => (await parentOf(stack, opened, "t:2"))?.id).toBe(group)
  await page.keyboard.press("ControlOrMeta+Shift+g")
  await expect.poll(async () => (await savedNode(stack, opened, group))?.parent).toBeNull()

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await parentOf(stack, opened, group))?.id).toBe(opened.slide)
  expect((await parentOf(stack, opened, "t:1"))?.id).toBe(group)
  expect((await parentOf(stack, opened, "t:2"))?.id).toBe(group)
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 500, y: 0 })
  expect((await savedNode(stack, opened, group))?.box).toMatchObject({ x: 100, y: 700, w: 700, h: 120 })

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await savedNode(stack, opened, group))?.parent).toBeNull()
  expect((await parentOf(stack, opened, "t:1"))?.id).toBe(opened.slide)
  expect((await parentOf(stack, opened, "t:2"))?.id).toBe(opened.slide)
  expect((await savedNode(stack, opened, "t:2"))?.box).toMatchObject({ x: 600, y: 700 })
})

test("Ctrl+Alt+G wraps the selection in a clipping frame that covers it, and one undo takes the frame away", async ({
  page,
  context,
  stack,
}) => {
  covers("frame")
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 700, 760)
  await page.keyboard.down(shift)
  await clickSlide(page, 1200, 760)
  await page.keyboard.up(shift)
  expect(await selectedIds(page)).toEqual(["t:2", "t:3"])
  await page.keyboard.press("ControlOrMeta+Alt+g")
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1)
  const [frame] = await selectedIds(page)
  await expect.poll(async () => (await savedNode(stack, opened, frame ?? ""))?.name).toBe(frameCopy.frame)
  const saved = await savedNode(stack, opened, frame ?? "")
  expect(saved?.type).toBe("frame")
  expect(saved?.clip).toBe(true)
  expect(saved?.box).toMatchObject({ x: 600, y: 700, w: 700, h: 120 })
  expect((await parentOf(stack, opened, "t:2"))?.id).toBe(frame)
  expect((await parentOf(stack, opened, "t:3"))?.id).toBe(frame)
  expect((await savedNode(stack, opened, "t:3"))?.box).toMatchObject({ x: 500, y: 0 })
  expect((await parentOf(stack, opened, "t:1"))?.id).toBe(opened.slide)

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await parentOf(stack, opened, "t:2"))?.id).toBe(opened.slide)
  expect((await savedNode(stack, opened, frame ?? ""))?.parent).toBeNull()
})

test("Ctrl+X takes a layer off the slide and Ctrl+V brings a copy back where it was", async ({
  page,
  context,
  stack,
}) => {
  covers("cut")
  const opened = await threeBoxes(page, context, stack)
  await clickSlide(page, 700, 760)
  expect(await selectedIds(page)).toEqual(["t:2"])
  await page.keyboard.press("ControlOrMeta+x")
  await expect.poll(async () => (await savedNode(stack, opened, "t:2"))?.parent).toBeNull()
  await expect.poll(() => shapeCount(page)).toBe(3)
  expect(await selectedIds(page)).toEqual([])

  await page.keyboard.press("ControlOrMeta+v")
  await expect.poll(() => shapeCount(page)).toBe(4)
  const [pasted] = await selectedIds(page)
  expect(pasted).toBeDefined()
  expect(pasted).not.toBe("t:2")
  await expect.poll(async () => (await savedNode(stack, opened, pasted ?? ""))?.type).toBe("shape")
  const copy = await savedNode(stack, opened, pasted ?? "")
  expect((copy?.parent as Parent)?.id).toBe(opened.slide)
  expect(copy?.box).toMatchObject({ x: 600, y: 700, w: 200, h: 120 })
  expect((await savedNode(stack, opened, "t:2"))?.parent).toBeNull()

  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => shapeCount(page)).toBe(3)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(() => shapeCount(page)).toBe(4)
  await expect.poll(async () => (await parentOf(stack, opened, "t:2"))?.id).toBe(opened.slide)
  expect(((await savedNode(stack, opened, "t:2"))?.box as Box).x).toBe(600)
})
