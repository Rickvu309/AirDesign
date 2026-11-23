import { expect, type Page } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/doom-editor-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, landNodes, openDoomEditor, savedNode, spot, type Opened } from "./doom-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

type Stack = Parameters<typeof savedNode>[0]

const layer = (chars: string) => ({
  box: spot(200, 600, 800, 300),
  text: {
    chars,
    spans: [],
    paras: chars.split("\n").map(() => ({})),
    style: "body",
    resize: "fixed",
    alignV: "top",
  },
})

async function seeded(page: Page, stack: Stack, opened: Opened, chars: string) {
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: layer(chars) }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  await clickSlide(page, 300, 640)
}

type Saved = {
  chars: string
  spans: { end: number; italic?: boolean; underline?: boolean; strike?: boolean; link?: string }[]
  paras: { align?: string; list?: string; level?: number }[]
}

const textOf = async (stack: Stack, opened: Opened) =>
  (await savedNode(stack, opened, "t:1"))?.text as Saved | undefined
const runs = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-run]')
const lines = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-line]')
const labels = (page: Page) => page.locator('[data-slide-box] [data-node="t:1"] [data-label]')
const editor = (page: Page) => page.locator("[data-text-editor]")

async function edit(page: Page) {
  await page.keyboard.press("Enter")
  await expect(editor(page)).toBeFocused()
}

async function leave(page: Page) {
  await page.keyboard.press("Escape")
  await expect(editor(page)).toHaveCount(0)
}

test("Ctrl+I, Ctrl+U and Ctrl+Shift+X italicize, underline and strike the selected words, and a second press takes each off", async ({
  page,
  context,
  stack,
}) => {
  covers("italic", "underline", "strike")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "Alpha beta")
  await edit(page)
  const style = (name: "fontStyle" | "textDecorationLine") =>
    runs(page)
      .first()
      .evaluate((node, key) => getComputedStyle(node)[key], name)

  await page.keyboard.press("ControlOrMeta+i")
  await expect.poll(() => style("fontStyle")).toBe("italic")
  await page.keyboard.press("ControlOrMeta+u")
  await expect.poll(() => style("textDecorationLine")).toBe("underline")
  await page.keyboard.press("ControlOrMeta+Shift+KeyX")
  await expect.poll(() => style("textDecorationLine")).toBe("underline line-through")
  await leave(page)
  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 10, italic: true, underline: true, strike: true }])

  await edit(page)
  await page.keyboard.press("ControlOrMeta+i")
  await page.keyboard.press("ControlOrMeta+u")
  await page.keyboard.press("ControlOrMeta+Shift+KeyX")
  await expect.poll(() => style("fontStyle")).toBe("normal")
  await expect.poll(() => style("textDecorationLine")).toBe("none")
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.spans).toEqual([])
})

test("Ctrl+Shift+X strikes only the words selected, and the rest stay plain", async ({ page, context, stack }) => {
  covers("strike", "italic")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "Alpha beta")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+Home")
  for (let step = 0; step < 5; step++) await page.keyboard.press("Shift+ArrowRight")
  await page.keyboard.press("ControlOrMeta+Shift+KeyX")
  await page.keyboard.press("ControlOrMeta+i")
  await leave(page)
  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 5, italic: true, strike: true }, { end: 10 }])
  await expect(runs(page).first()).toHaveText("Alpha")
  await expect(runs(page).first()).toHaveCSS("text-decoration-line", "line-through")
  await expect(runs(page).last()).toHaveCSS("text-decoration-line", "none")
})

test("Ctrl+Alt+T, R, J and L align the paragraphs the cursor touches and leave the others alone", async ({
  page,
  context,
  stack,
}) => {
  covers("text-left", "text-center", "text-right", "text-justify")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "First line\nSecond line")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+End")
  for (const [key, align] of [
    ["ControlOrMeta+Alt+KeyT", "center"],
    ["ControlOrMeta+Alt+KeyR", "right"],
    ["ControlOrMeta+Alt+KeyJ", "justify"],
    ["ControlOrMeta+Alt+KeyL", "left"],
  ] as const) {
    await page.keyboard.press(key)
    await leave(page)
    await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, { align }])
    await expect(lines(page).first()).toHaveCSS("text-align", "left")
    await expect(lines(page).nth(1)).toHaveCSS("text-align", align === "justify" ? "left" : align)
    await edit(page)
    await page.keyboard.press("ControlOrMeta+End")
  }
  await page.keyboard.press("ControlOrMeta+Alt+KeyR")
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, { align: "right" }])

  await page.reload()
  await page.locator("[data-doom-ready]").waitFor()
  await expect(lines(page).nth(1)).toHaveCSS("text-align", "right")
})

test("Ctrl+Shift+8 bullets every paragraph selected and a second press takes the bullets off", async ({
  page,
  context,
  stack,
}) => {
  covers("bullets")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "One\nTwo")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  await expect(labels(page)).toHaveCount(2)
  await expect(labels(page).first()).toHaveText("\u2022")
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{ list: "bullet" }, { list: "bullet" }])

  await edit(page)
  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  await expect(labels(page)).toHaveCount(0)
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, {}])
})

test("Ctrl+Shift+7 numbers every paragraph selected and a second press takes the numbers off", async ({
  page,
  context,
  stack,
}) => {
  covers("numbers")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "One\nTwo")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+Shift+Digit7")
  await expect(labels(page)).toHaveText(["1.", "2."])
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{ list: "number" }, { list: "number" }])

  await edit(page)
  await page.keyboard.press("ControlOrMeta+Shift+Digit7")
  await expect(labels(page)).toHaveCount(0)
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, {}])
})

test("Tab and Ctrl+] indent a bulleted paragraph, Shift+Tab and Ctrl+[ take it back, and plain paragraphs do not move", async ({
  page,
  context,
  stack,
}) => {
  covers("list-indent", "list-outdent", "bullets")
  const opened = await openDoomEditor(page, context, stack)
  await seeded(page, stack, opened, "One\nTwo")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+End")
  const left = () =>
    lines(page)
      .nth(1)
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).left))
  const plain = await left()
  await page.keyboard.press("Tab")
  expect(await left()).toBe(plain)
  await expect(editor(page)).toBeFocused()

  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  await expect(labels(page)).toHaveCount(1)
  const flat = await left()
  await page.keyboard.press("Tab")
  await expect.poll(left).toBeGreaterThan(flat)
  const one = await left()
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(left).toBeGreaterThan(one)
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, { list: "bullet", level: 2 }])

  await edit(page)
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.press("Shift+Tab")
  await expect.poll(left).toBeCloseTo(one, 1)
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect.poll(left).toBeCloseTo(flat, 1)
  await expect(editor(page)).toBeFocused()
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.paras).toEqual([{}, { list: "bullet" }])
})

test("linked words are underlined, and the Link section reads and changes the link of the words the caret is in", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openDoomEditor(page, context, stack)
  await page.getByRole("button", { name: doomEditorCopy.panelDesign, exact: true }).click()
  const linked = {
    ...layer("Read the site"),
    text: { ...layer("Read the site").text, spans: [{ end: 9 }, { end: 13, link: "https://a.example/" }] },
  }
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: linked }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  const decoration = (at: number) =>
    runs(page)
      .nth(at)
      .evaluate((node) => getComputedStyle(node).textDecorationLine)
  await expect.poll(() => decoration(1)).toBe("underline")
  expect(await decoration(0)).toBe("none")

  await clickSlide(page, 300, 640)
  const address = page.locator(`[data-design-section="${linkCopy.section}"]`).getByRole("textbox")
  await expect(address).toHaveValue("")
  await edit(page)
  await page.keyboard.press("End")
  await page.keyboard.press("ArrowLeft")
  await expect(address).toHaveValue("https://a.example/")
  await page.keyboard.press("Home")
  await expect(address).toHaveValue("")
  await page.keyboard.press("End")
  await expect(address).toHaveValue("https://a.example/")

  await address.fill("https://b.example/")
  await address.press("Enter")
  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 9 }, { end: 13, link: "https://b.example/" }])
  expect((await savedNode(stack, opened, "t:1"))?.link).toBeUndefined()
})
