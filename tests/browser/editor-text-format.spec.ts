import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { linkCopy } from "../../apps/web/src/copy/link-copy"
import { test } from "./api-stack"
import { covers } from "./gesture"
import { clickSlide, landNodes, openEditor, savedNode, spot } from "./editor-deck"
import { edit, editor, labels, layer, leave, lines, runs, seeded, textOf } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

test("Ctrl+I, Ctrl+U and Ctrl+Shift+X italicize, underline and strike the selected words, and a second press takes each off", async ({
  page,
  context,
  stack,
}) => {
  covers("italic", "underline", "strike")
  const opened = await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
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

test("the Italic button italicizes the words selected at the click, even before the canvas hears the last change", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await seeded(page, stack, opened, "Alpha beta")
  await edit(page)
  await page.keyboard.press("ControlOrMeta+Home")
  for (let step = 0; step < 4; step++) await page.keyboard.press("Shift+ArrowRight")
  const italic = page.getByRole("button", { name: editorCopy.italic })
  await italic.evaluate((button: HTMLButtonElement) => {
    button.ownerDocument.getSelection()?.modify("extend", "forward", "character")
    button.click()
  })
  await expect(italic).toHaveAttribute("aria-pressed", "true")
  await leave(page)
  await expect.poll(async () => (await textOf(stack, opened))?.spans).toEqual([{ end: 5, italic: true }, { end: 10 }])
})

for (const mark of ["bold", "italic"] as const) {
  test(`the ${mark} button keeps unselected heading text in the served semibold face`, async ({
    page,
    context,
    stack,
  }) => {
    const opened = await openEditor(page, context, stack)
    const heading = layer("Alpha beta")
    await landNodes(stack, opened, [
      {
        id: "t:1",
        type: "shape",
        parent: opened.slide,
        props: { ...heading, text: { ...heading.text, style: "heading" } },
      },
    ])
    await expect(runs(page).first()).toHaveCSS("font-family", /airdesign-face-/)
    await clickSlide(page, 300, 640)
    await edit(page)
    await page.keyboard.press("ControlOrMeta+Home")
    for (let step = 0; step < 5; step++) await page.keyboard.press("Shift+ArrowRight")
    await page.getByRole("button", { name: editorCopy[mark], exact: true }).click()
    const editingRuns = editor(page).locator("[data-run]")
    await expect(editingRuns.first()).toHaveText("Alpha")
    await expect(editingRuns.last()).toHaveText("beta", { useInnerText: true })
    await expect(editingRuns.first()).toHaveCSS(
      mark === "bold" ? "font-weight" : "font-style",
      mark === "bold" ? "700" : "italic",
    )
    await expect(editingRuns.last()).toHaveCSS("font-family", /airdesign-face-/)
    await expect(editingRuns.last()).toHaveCSS("font-weight", "600")
  })
}

test("Ctrl+Alt+T, R, J and L align the paragraphs the cursor touches and leave the others alone", async ({
  page,
  context,
  stack,
}) => {
  covers("text-left", "text-center", "text-right", "text-justify")
  const opened = await openEditor(page, context, stack)
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
  await page.locator("[data-editor-ready]").waitFor()
  await expect(lines(page).nth(1)).toHaveCSS("text-align", "right")
})

test("Ctrl+Shift+8 bullets every paragraph selected and a second press takes the bullets off", async ({
  page,
  context,
  stack,
}) => {
  covers("bullets")
  const opened = await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
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
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
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

test("selecting across two different links shows Mixed, leaves them alone on Enter, and replaces both when changed", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const both = [{ end: 3, link: "https://a.example/" }, { end: 8 }, { end: 11, link: "https://b.example/" }]
  const linked = {
    ...layer("One and two"),
    text: { ...layer("One and two").text, spans: both },
  }
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: linked }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)

  await clickSlide(page, 300, 640)
  const address = page.locator(`[data-design-section="${linkCopy.section}"]`).getByRole("textbox")
  await edit(page)
  await expect(address).toHaveValue(linkCopy.mixed)

  await address.click()
  await address.press("Enter")
  await expect(address).toHaveValue(linkCopy.mixed)

  await editor(page).focus()
  await page.keyboard.press("Home")
  await expect(address).toHaveValue("")
  for (let step = 0; step < 5; step++) await page.keyboard.press("Shift+ArrowRight")
  await expect(address).toHaveValue(linkCopy.mixed)

  await page.keyboard.press("ControlOrMeta+a")
  await expect(address).toHaveValue(linkCopy.mixed)
  await address.fill("https://c.example/")
  await address.press("Enter")
  await expect.poll(async () => (await textOf(stack, opened))?.spans).toEqual([{ end: 11, link: "https://c.example/" }])
})

test("copying and pasting linked words keeps web links within a deck and between decks, and drops foreign slide links", async ({
  page,
  context,
  stack,
}) => {
  const first = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const source = {
    ...layer("Read site and slide"),
    text: {
      ...layer("Read site and slide").text,
      spans: [{ end: 5 }, { end: 9, link: "https://a.example/" }, { end: 14 }, { end: 19, link: first.slide }],
    },
  }
  const target = { ...layer("Here: "), box: spot(200, 920, 800, 120) }
  await landNodes(stack, first, [
    { id: "t:1", type: "shape", parent: first.slide, props: source },
    { id: "t:2", type: "shape", parent: first.slide, props: target },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(4)

  await clickSlide(page, 300, 640)
  await edit(page)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+c")
  await leave(page)

  await clickSlide(page, 300, 960)
  await edit(page)
  await page.keyboard.press("End")
  await page.keyboard.press("ControlOrMeta+v")
  await leave(page)
  await expect
    .poll(async () => (await savedNode(stack, first, "t:2"))?.text)
    .toMatchObject({
      chars: "Here: Read site and slide",
      spans: [{ end: 11 }, { end: 15, link: "https://a.example/" }, { end: 20 }, { end: 25, link: first.slide }],
    })
  await expect
    .poll(() =>
      page
        .locator('[data-slide-box] [data-node="t:2"] [data-link="https://a.example/"]')
        .evaluate((node) => getComputedStyle(node).textDecorationLine),
    )
    .toBe("underline")

  const second = await openEditor(page, context, stack)
  await landNodes(stack, second, [{ id: "t:1", type: "shape", parent: second.slide, props: layer("Deck two: ") }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)
  await clickSlide(page, 300, 640)
  await edit(page)
  await page.keyboard.press("End")
  await page.keyboard.press("ControlOrMeta+v")
  await leave(page)
  await expect
    .poll(async () => (await textOf(stack, second))?.spans)
    .toEqual([{ end: 15 }, { end: 19, link: "https://a.example/" }, { end: 29 }])
  expect((await textOf(stack, second))?.chars).toBe("Deck two: Read site and slide")
})

test("undo after pasting linked words restores the text in one step and redo brings the link back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const source = {
    ...layer("Read site"),
    text: { ...layer("Read site").text, spans: [{ end: 5 }, { end: 9, link: "https://a.example/" }] },
  }
  const target = { ...layer("Go "), box: spot(200, 920, 800, 120) }
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: source },
    { id: "t:2", type: "shape", parent: opened.slide, props: target },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(4)

  await clickSlide(page, 300, 640)
  await edit(page)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+c")
  await leave(page)

  await clickSlide(page, 300, 960)
  await edit(page)
  await page.keyboard.press("End")
  await page.keyboard.press("ControlOrMeta+v")
  await leave(page)
  await expect
    .poll(async () => (await savedNode(stack, opened, "t:2"))?.text)
    .toMatchObject({
      chars: "Go Read site",
      spans: [{ end: 8 }, { end: 12, link: "https://a.example/" }],
    })

  await page.keyboard.press("ControlOrMeta+z")
  await expect
    .poll(async () => (await savedNode(stack, opened, "t:2"))?.text)
    .toMatchObject({ chars: "Go ", spans: [] })
  await expect(page.locator('[data-slide-box] [data-node="t:2"] [data-link="https://a.example/"]')).toHaveCount(0)

  await page.keyboard.press("ControlOrMeta+Shift+z")
  await expect
    .poll(async () => (await savedNode(stack, opened, "t:2"))?.text)
    .toMatchObject({
      chars: "Go Read site",
      spans: [{ end: 8 }, { end: 12, link: "https://a.example/" }],
    })
  await expect(page.locator('[data-slide-box] [data-node="t:2"] [data-link="https://a.example/"]')).toHaveCount(1)
})

test("pasting linked words into a layer with a layer-level link keeps both the word link and the layer link", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const source = {
    ...layer("Read site"),
    text: { ...layer("Read site").text, spans: [{ end: 5 }, { end: 9, link: "https://a.example/" }] },
  }
  const target = {
    ...layer("Go "),
    box: spot(200, 920, 800, 120),
    link: "https://layer.example/",
  }
  await landNodes(stack, opened, [
    { id: "t:1", type: "shape", parent: opened.slide, props: source },
    { id: "t:2", type: "shape", parent: opened.slide, props: target },
  ])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(4)

  await clickSlide(page, 300, 640)
  await edit(page)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+c")
  await leave(page)

  const address = page.locator(`[data-design-section="${linkCopy.section}"]`).getByRole("textbox")
  await clickSlide(page, 300, 960)
  await expect(address).toHaveValue("https://layer.example/")
  await edit(page)
  await page.keyboard.press("End")
  await page.keyboard.press("ControlOrMeta+v")
  await expect(address).toHaveValue("https://a.example/")
  await leave(page)
  await expect(address).toHaveValue("https://layer.example/")

  await expect
    .poll(async () => await savedNode(stack, opened, "t:2"))
    .toMatchObject({
      link: "https://layer.example/",
      text: {
        chars: "Go Read site",
        spans: [{ end: 8 }, { end: 12, link: "https://a.example/" }],
      },
    })
  await expect
    .poll(() =>
      page
        .locator('[data-slide-box] [data-node="t:2"] [data-link="https://a.example/"]')
        .evaluate((node) => getComputedStyle(node).textDecorationLine),
    )
    .toBe("underline")
})

test("typing just after a link's last letter extends the link, while typing before its first letter stays plain", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: editorCopy.panelDesign, exact: true }).click()
  const linked = {
    ...layer("Read site now"),
    text: {
      ...layer("Read site now").text,
      spans: [{ end: 5 }, { end: 9, link: "https://a.example/" }, { end: 13 }],
    },
  }
  await landNodes(stack, opened, [{ id: "t:1", type: "shape", parent: opened.slide, props: linked }])
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(3)

  await clickSlide(page, 300, 640)
  const address = page.locator(`[data-design-section="${linkCopy.section}"]`).getByRole("textbox")
  await edit(page)
  await page.keyboard.press("Home")
  for (let step = 0; step < 9; step++) await page.keyboard.press("ArrowRight")
  await expect(address).toHaveValue("https://a.example/")
  await page.keyboard.type("map")
  await expect(address).toHaveValue("https://a.example/")

  await page.keyboard.press("Home")
  for (let step = 0; step < 5; step++) await page.keyboard.press("ArrowRight")
  await expect(address).toHaveValue("")
  await page.keyboard.type("a ")
  await leave(page)

  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 7 }, { end: 14, link: "https://a.example/" }, { end: 18 }])
  expect((await textOf(stack, opened))?.chars).toBe("Read a sitemap now")
})
