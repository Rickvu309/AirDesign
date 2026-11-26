import { expect, type Locator, type Page } from "@playwright/test"
import { designCopy } from "../../apps/web/src/copy/design-copy"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, landProps, openEditor, savedNode, type Opened } from "./editor-deck"
import { covers } from "./gesture"
import { card, entry, openGrid, percent, said, zoomTo } from "./grid-deck"
import { layer, textOf, type Stack } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" })

const live = (page: Page) => page.locator("[data-editor-grid] [data-grid-edit]")
const node = (page: Page) => page.locator('[data-editor-grid] [data-node="t:1"]')
const outline = (page: Page) => live(page).locator("[data-selection-outline]")
const editor = (page: Page) => page.locator("[data-text-editor]")

async function twoSlides(page: Page, context: Parameters<typeof openEditor>[1], stack: Stack) {
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: layer("Hello grid") }])
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  await openGrid(page)
  await expect(entry(page, 2)).toHaveAttribute("aria-current", "true")
  await expect(live(page)).toHaveCount(0)
  await expect(node(page)).toBeVisible()
  return opened
}

async function xOf(stack: Stack, opened: Opened): Promise<number> {
  const box = (await savedNode(stack, opened, "t:1"))?.box as { x?: number } | undefined
  return box?.x ?? Number.NaN
}

async function drag(page: Page, target: Locator, dx: number) {
  const box = await target.boundingBox()
  if (box === null) throw new Error("no box")
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  await page.mouse.up()
}

test("a press on another slide's element selects it in the one live editor, and one undo undoes one drag", async ({
  page,
  context,
  stack,
}) => {
  covers("select", "move", "undo")
  const opened = await twoSlides(page, context, stack)
  const start = await xOf(stack, opened)
  await drag(page, node(page), 48)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
  await expect(live(page)).toHaveCount(1)
  await expect(card(page, 2).locator("[data-grid-edit]")).toHaveCount(0)
  await expect(outline(page)).toHaveCount(1)
  await expect(live(page)).toBeFocused()
  await expect(editor(page)).toHaveCount(0)
  await expect.poll(async () => Math.abs((await xOf(stack, opened)) - start)).toBeGreaterThan(5)
  const once = await xOf(stack, opened)
  await drag(page, live(page).locator('[data-node="t:1"]'), 48)
  await expect.poll(async () => Math.abs((await xOf(stack, opened)) - once)).toBeGreaterThan(5)
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => Math.abs((await xOf(stack, opened)) - once)).toBeLessThan(2)
})

test("a double click places a caret, formatting saves, and Escape steps back to the slide and then to nothing", async ({
  page,
  context,
  stack,
}) => {
  covers("edit-text", "bold", "deselect", "redo")
  const opened = await twoSlides(page, context, stack)
  await node(page).dblclick()
  await expect(editor(page)).toBeFocused()
  await expect
    .poll(() =>
      editor(page).evaluate((field) => {
        const selection = document.getSelection()
        return selection !== null && selection.isCollapsed && field.contains(selection.anchorNode)
      }),
    )
    .toBe(true)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Typed in Grid")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+b")
  await page.keyboard.press("Escape")
  await expect(editor(page)).toHaveCount(0)
  await expect(live(page)).toBeFocused()
  await expect(outline(page)).toHaveCount(1)
  await expect.poll(async () => (await textOf(stack, opened))?.chars).toBe("Typed in Grid")
  await expect.poll(async () => (await textOf(stack, opened))?.spans.some((span) => span.bold === true)).toBe(true)
  await page.keyboard.press("Escape")
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toBeFocused()
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "true")
  await expect(said(page)).toHaveText(slideListCopy.selected(1))
  await page.keyboard.press("Escape")
  await expect(page.getByRole("group", { name: slideListCopy.listName, exact: true })).toBeFocused()
  await expect(said(page)).toHaveText(slideListCopy.nothingSelected)
  await expect(page.locator("[data-editor-grid] [data-selected]")).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect.poll(async () => (await textOf(stack, opened))?.chars).toBe("Typed in Grid")
})

test("a blank press picks the slide, the Design panel follows, and leaving Grid returns to the same element", async ({
  page,
  context,
  stack,
}) => {
  covers("deselect")
  await twoSlides(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  await node(page).click()
  await expect(page.locator("[data-design-element]")).toBeVisible()
  const paint = live(page).locator("[data-slide-box]")
  const box = await paint.boundingBox()
  if (box === null) throw new Error("no live slide")
  await page.mouse.click(box.x + box.width - 12, box.y + box.height - 12)
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "true")
  await expect(entry(page, 1)).toBeFocused()
  await expect(page.locator("[data-design-element]")).toHaveCount(0)
  await expect(page.locator("[data-design-head]")).toHaveText(designCopy.slide(1))
  await node(page).click()
  await expect(page.locator("[data-design-element]")).toBeVisible()
  await page.getByRole("button", { name: slideListCopy.slidesView }).click()
  await expect(page.locator("[data-editor-canvas] [data-selection-outline]")).toHaveCount(1)
  await openGrid(page)
  await expect(live(page).locator("[data-selection-outline]")).toHaveCount(1)
  await expect(entry(page, 1)).toHaveAttribute("aria-current", "true")
})

test("Shift+2 fits the selected element, and a press on a small slide picks the slide", async ({
  page,
  context,
  stack,
}) => {
  covers("zoom-selection", "select")
  await twoSlides(page, context, stack)
  await node(page).click()
  const before = await card(page, 1).boundingBox()
  if (before === null) throw new Error("no card")
  await page.keyboard.press("Shift+Digit2")
  await expect.poll(async () => (await card(page, 1).boundingBox())?.width ?? 0).toBeGreaterThan(before.width * 1.4)
  await zoomTo(page, "fit")
  const fitted = await card(page, 1).boundingBox()
  const now = await percent(page)
  if (fitted === null) throw new Error("no card")
  await zoomTo(page, Math.max(1, Math.floor((now * 70) / fitted.width)))
  await expect.poll(async () => (await card(page, 1).boundingBox())?.width ?? 999).toBeLessThan(88)
  await node(page).click({ force: true })
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toHaveAttribute("data-selected", "true")
})

test("the text tool places a layer on the current slide and the edit survives a reload", async ({
  page,
  context,
  stack,
}) => {
  covers("tool-text", "undo")
  const opened = await twoSlides(page, context, stack)
  await page.getByRole("button", { name: editorCopy.textTool, exact: true }).click()
  await expect(live(page)).toHaveCount(1)
  await expect(card(page, 2).locator("[data-grid-edit]")).toHaveCount(1)
  await expect(page.locator("[data-editor-canvas]")).toHaveCount(0)
  await clickSlide(page, 300, 760)
  await expect(editor(page)).toBeFocused()
  await page.keyboard.type("Placed in Grid")
  await page.keyboard.press("Escape")
  await expect(page.locator("[data-editor-grid]")).toBeVisible()
  const [id] = await page
    .locator("[data-selection-outline]")
    .evaluateAll((all) => all.flatMap((each) => each.getAttribute("data-selection-outline") ?? []))
  expect(id).toBeTruthy()
  await expect
    .poll(async () => (await savedNode(stack, opened, id ?? ""))?.text)
    .toMatchObject({ chars: "Placed in Grid" })
  await page.keyboard.press("ControlOrMeta+z")
  await expect.poll(async () => (await savedNode(stack, opened, id ?? ""))?.parent ?? null).toBeNull()
  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect
    .poll(async () => (await savedNode(stack, opened, id ?? ""))?.text)
    .toMatchObject({ chars: "Placed in Grid" })
  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await openGrid(page)
  await expect(page.locator("[data-editor-grid]").getByText("Placed in Grid")).toBeVisible()
})

test("another tab deleting the live slide leaves editing and focuses a remaining slide", async ({
  page,
  context,
  stack,
}) => {
  const opened = await twoSlides(page, context, stack)
  await node(page).dblclick()
  await expect(editor(page)).toBeFocused()
  await page.keyboard.insertText("Draft")
  await landProps(stack, opened, opened.slide, { parent: null })
  await expect(page.locator("[data-editor-grid] [data-slide-entry]")).toHaveCount(1)
  await expect(editor(page)).toHaveCount(0)
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toBeFocused()
})

test("Delete, Ctrl+D and the arrow keys act on the layer while it is edited, and Delete removes the slide once editing ends", async ({
  page,
  context,
  stack,
}) => {
  covers("delete", "duplicate", "nudge", "slide-delete")
  const opened = await twoSlides(page, context, stack)
  const slides = () => page.locator("[data-editor-grid] [data-slide-entry]")
  const shapes = () => live(page).locator("[data-node]")
  const start = await xOf(stack, opened)
  await node(page).click()
  await expect(live(page)).toBeFocused()
  await expect(slides()).toHaveCount(2)

  await page.keyboard.press("Alt+ArrowRight")
  await expect.poll(async () => xOf(stack, opened)).toBe(start)
  await expect(slides()).toHaveCount(2)

  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => xOf(stack, opened)).toBe(start + 1)
  await expect(slides()).toHaveCount(2)

  const before = await shapes().count()
  await page.keyboard.press("ControlOrMeta+d")
  await expect.poll(() => shapes().count()).toBe(before + 1)
  await expect(slides()).toHaveCount(2)
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent ?? null).not.toBeNull()

  await page.keyboard.press("Delete")
  await expect.poll(() => shapes().count()).toBe(before)
  await expect(slides()).toHaveCount(2)
  await expect.poll(async () => (await savedNode(stack, opened, "t:1"))?.parent ?? null).not.toBeNull()

  await page.keyboard.press("Escape")
  await expect(live(page)).toHaveCount(0)
  await expect(entry(page, 1)).toBeFocused()
  await page.keyboard.press("Delete")
  await expect(slides()).toHaveCount(1)
})
