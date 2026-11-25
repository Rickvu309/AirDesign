import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor } from "./editor-deck"
import { edit, editor, layer, leave, runs, textOf } from "./text-layer"

test.use({ viewport: { width: 1600, height: 1000 } })

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

for (const change of ["bold", "italic", "ime"] as const) {
  test(`a single ${change} insertion keeps the heading in its served face`, async ({ page, context, stack }) => {
    const opened = await openEditor(page, context, stack)
    const heading = layer("Tokyo office")
    await landNodes(stack, opened, [
      {
        id: "t:1",
        type: "shape",
        parent: opened.slide,
        props: { ...heading, text: { ...heading.text, style: "heading" } },
      },
    ])
    const initial = runs(page).first()
    await expect(initial).toHaveCSS("font-family", /airdesign-face-/)
    const family = await initial.evaluate((run) => getComputedStyle(run).fontFamily)
    await clickSlide(page, 300, 640)
    await edit(page)
    await page.keyboard.press("ControlOrMeta+End")

    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route("**/fonts/**", async (route) => {
      await held
      await route.continue()
    })

    const inserted = change === "ime" ? "東京" : "x"
    if (change === "ime") {
      const cdp = await context.newCDPSession(page)
      await cdp.send("Input.imeSetComposition", { text: "とうきょう", selectionStart: 5, selectionEnd: 5 })
      await cdp.send("Input.insertText", { text: inserted })
      await cdp.detach()
    } else {
      await page.keyboard.press(change === "bold" ? "ControlOrMeta+b" : "ControlOrMeta+i")
      await page.keyboard.press(inserted)
    }

    const editing = editor(page).locator("[data-run]")
    await expect(editor(page)).toHaveText(heading.text.chars + inserted)
    try {
      expect(
        await editing.first().evaluate((run) => {
          const style = getComputedStyle(run)
          return { family: style.fontFamily, weight: style.fontWeight }
        }),
      ).toEqual({ family, weight: "600" })
    } finally {
      release()
    }
    await expect(editing.last()).toHaveText(inserted)
    await expect(editing.last()).toHaveCSS("font-family", /airdesign-face-/)
    if (change === "ime") {
      const painted = await editing.last().evaluate((run) => {
        const css = getComputedStyle(run)
        return { family: css.fontFamily, weight: css.fontWeight }
      })
      await leave(page)
      await expect(runs(page).last()).toHaveCSS("font-family", painted.family)
      await expect(runs(page).last()).toHaveCSS("font-weight", painted.weight)
    } else await expect(editing.last()).toHaveCSS("font-weight", change === "bold" ? "700" : "600")
    if (change === "italic") await expect(editing.last()).toHaveCSS("font-style", "italic")
  })
}

test("a font that arrives while a new selection is still unheard keeps that selection for the next key", async ({
  page,
  context,
  stack,
}) => {
  const opened = await openEditor(page, context, stack)
  const heading = layer("Tokyo office")
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
  await page.evaluate(() => {
    const listenTo = document.addEventListener.bind(document)
    document.addEventListener = (type: string, heard: EventListener, options?: AddEventListenerOptions) => {
      const late = (event: Event) => setTimeout(() => heard(event), 1500)
      listenTo(type, type === "selectionchange" ? late : heard, options)
    }
  })
  await edit(page)
  await page.keyboard.press("ControlOrMeta+End")
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/fonts/**", async (route) => {
    await held
    await route.continue()
  })
  await page.keyboard.press("ControlOrMeta+i")
  await page.keyboard.press("x")
  const pending = editor(page).locator("[data-run][data-font-pending]")
  await expect(pending).not.toHaveCount(0)
  for (let step = 0; step < 5; step++) await page.keyboard.press("Shift+ArrowLeft")
  release()
  await expect(pending).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+b")
  await leave(page)
  await expect
    .poll(async () => (await textOf(stack, opened))?.spans)
    .toEqual([{ end: 8 }, { end: 12, bold: true }, { end: 13, bold: true, italic: true }])
})
