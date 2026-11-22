import { expect, type Page } from "@playwright/test"
import { sceneEditorCopy } from "../../apps/web/src/copy/scene-editor-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import {
  accent,
  clickSlide,
  dragSlide,
  landNodes,
  openSceneEditor,
  savedNode,
  selectedIds,
  spot,
  type Opened,
} from "./scene-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]
type Saved = {
  chars: string
  spans: { end: number; bold?: boolean; italic?: boolean }[]
  paras: object[]
  style: string
  resize: string
}

const textOf = async (stack: Stack, opened: Opened, id: string) =>
  (await savedNode(stack, opened, id))?.text as Saved | undefined
const editor = (page: Page) => page.locator("[data-text-editor]")

test("the Text tool places a text layer, typing and Ctrl+B write it, and Escape keeps it through a reload", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-text", "bold", "deselect")
  const opened = await openSceneEditor(page, context, stack)
  await page.keyboard.press("t")
  await expect(page.getByRole("button", { name: sceneEditorCopy.textTool })).toHaveAttribute("aria-pressed", "true")
  await clickSlide(page, 300, 700)
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type("Hello world")
  await expect(editor(page)).toContainText("Hello world")
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("ControlOrMeta+b")
  await expect(page.getByRole("button", { name: sceneEditorCopy.bold })).toHaveAttribute("aria-pressed", "true")
  await page.keyboard.press("Escape")
  await expect(editor(page)).toHaveCount(0)
  const [id] = await selectedIds(page)
  expect(id).toBeDefined()
  await expect.poll(async () => (await textOf(stack, opened, id ?? ""))?.chars).toBe("Hello world")
  const saved = await textOf(stack, opened, id ?? "")
  expect(saved?.spans).toEqual([{ end: 6 }, { end: 11, bold: true }])
  expect(saved?.resize).toBe("widthAndHeight")
  expect((await savedNode(stack, opened, id ?? ""))?.box).toMatchObject({ x: 300, y: 700 })

  await page.reload()
  await page.locator("[data-scene-ready]").waitFor()
  await expect(page.locator("[data-slide-box] [data-line]").filter({ hasText: "Hello world" })).toHaveCount(1)
})

test("a drag with the Text tool draws a fixed box, and leaving it empty leaves no layer behind", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openSceneEditor(page, context, stack)
  await page.keyboard.press("t")
  await dragSlide(page, { x: 200, y: 600 }, { x: 800, y: 760 })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type("A long line of words that wraps inside the box that was drawn with the drag")
  await page.keyboard.press("Escape")
  const [id] = await selectedIds(page)
  await expect.poll(async () => (await textOf(stack, opened, id ?? ""))?.resize).toBe("fixed")
  expect((await savedNode(stack, opened, id ?? ""))?.box).toMatchObject({ x: 200, y: 600 })
  expect(await page.locator("[data-slide-box] [data-line]").count()).toBeGreaterThan(2)

  await page.keyboard.press("Escape")
  await page.keyboard.press("t")
  await clickSlide(page, 1200, 300)
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(2)
})

test("a double-click edits a text layer where it was clicked, Enter edits it with all selected, and emptying it removes it in one undo", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "undo")
  const opened = await openSceneEditor(page, context, stack)
  const title = "s:4"
  await clickSlide(page, 600, 410)
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type("Replaced")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Second")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await textOf(stack, opened, title))?.chars).toBe("Replaced\nSecond")
  expect((await textOf(stack, opened, title))?.paras).toHaveLength(2)

  await page.keyboard.press("Escape")
  await clickSlide(page, 300, 410, { double: true })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(0)
  await expect.poll(async () => (await savedNode(stack, opened, title))?.parent).toBeNull()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(1)
  await expect.poll(async () => (await textOf(stack, opened, title))?.chars).toBe("Replaced\nSecond")
})

test("a double-click on a shape with no words starts words inside it, makes no new layer, and leaving it empty keeps the shape", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text")
  const opened = await openSceneEditor(page, context, stack)
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: { box: spot(200, 600, 600, 300), fills: accent } },
  ])
  const layers = page.locator("[data-slide-box] [data-node]")
  await expect(layers).toHaveCount(2)

  await clickSlide(page, 300, 700, { double: true })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(layers).toHaveCount(2)
  expect((await savedNode(stack, opened, "t:1"))?.parent).not.toBeNull()
  expect((await savedNode(stack, opened, "t:1"))?.text).toBeUndefined()

  await clickSlide(page, 300, 700, { double: true })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type("Plan")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await textOf(stack, opened, "t:1"))?.chars).toBe("Plan")
  expect((await savedNode(stack, opened, "t:1"))?.box).toMatchObject(spot(200, 600, 600, 300))
  await expect(layers).toHaveCount(2)
  expect(await selectedIds(page)).toEqual(["t:1"])

  await clickSlide(page, 300, 700, { double: true })
  await expect(editor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await textOf(stack, opened, "t:1"))?.chars).toBe("")
  expect((await savedNode(stack, opened, "t:1"))?.parent).not.toBeNull()
  await expect(layers).toHaveCount(2)
})

test("pasted words keep their line breaks, and undo while typing takes back the last words typed", async ({
  page,
  context,
  stack,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const opened = await openSceneEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "t:1",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(200, 700, 600, 60),
        text: { chars: "first", spans: [], paras: [{}], style: "body", resize: "height", alignV: "top" },
      },
    },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(2)
  await clickSlide(page, 300, 720)
  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  await page.evaluate(() => navigator.clipboard.writeText("two\nthree"))
  await page.keyboard.press("ControlOrMeta+v")
  await expect(editor(page)).toContainText("three")
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await textOf(stack, opened, "t:1"))?.chars).toBe("firsttwo\nthree")
  expect((await textOf(stack, opened, "t:1"))?.paras).toHaveLength(2)

  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  await page.keyboard.type("!")
  await expect.poll(async () => (await textOf(stack, opened, "t:1"))?.chars).toBe("firsttwo\nthree!")
  await page.keyboard.type("??")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(editor(page)).toHaveCount(0)
  await expect.poll(async () => (await textOf(stack, opened, "t:1"))?.chars).toBe("firsttwo\nthree!")
})

test("the text bar sets the named style and Underline for the selected words", async ({ page, context, stack }) => {
  const opened = await openSceneEditor(page, context, stack)
  await clickSlide(page, 600, 410)
  await page.keyboard.press("Enter")
  await page.getByRole("button", { name: sceneEditorCopy.underline }).click()
  await page.getByRole("combobox", { name: sceneEditorCopy.textStyle }).click()
  await page.getByRole("option", { name: sceneEditorCopy.textStyles.heading, exact: true }).click()
  await page.keyboard.press("Escape")
  await expect.poll(async () => (await textOf(stack, opened, "s:4"))?.style).toBe("heading")
  expect((await textOf(stack, opened, "s:4"))?.spans).toEqual([{ end: 8, underline: true }])
})
