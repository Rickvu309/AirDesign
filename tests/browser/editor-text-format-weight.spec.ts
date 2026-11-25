import { expect } from "@playwright/test"
import { editorCopy } from "../../apps/web/src/copy/editor-copy"
import { test } from "./api-stack"
import { clickSlide, landNodes, openEditor } from "./editor-deck"
import { edit, editor, layer, runs } from "./text-layer"

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
