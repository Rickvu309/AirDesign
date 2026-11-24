import { expect } from "@playwright/test"
import { doomEditorCopy } from "../../apps/web/src/copy/editor-copy"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { test } from "./api-stack"
import { spot } from "./editor-deck"
import { designDoom, panel, pick, saved, undoOnStage, words } from "./editor-design"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a text style names the style, writes it to the text, and Undo puts the body style back", async ({
  page,
  context,
  stack,
}) => {
  const opened = await designDoom(page, context, stack, (slide) => [
    {
      id: "t:1",
      type: "shape",
      parent: slide,
      props: { box: spot(100, 100, 1400, 200), text: words("Quarterly review") },
    },
  ])
  const style = async () => (await saved(stack, opened, "t:1")).text.style
  await pick(page, "t:1", 400, 180)
  const styles = panel(page).getByRole("combobox", { name: textCopy.style, exact: true })
  await expect(styles).toContainText(doomEditorCopy.textStyles.body)
  await styles.click()
  await page.getByRole("option", { name: new RegExp(`^${doomEditorCopy.textStyles.title}`) }).click()
  await expect.poll(style).toBe("title")
  await expect(styles).toContainText(doomEditorCopy.textStyles.title)
  await undoOnStage(page)
  await expect.poll(style).toBe("body")
})
