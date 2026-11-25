import { expect } from "@playwright/test"
import { textEditor, titleEdited } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await titleEdited(kit)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Hello world")
  for (const _ of [1, 2, 3, 4, 5]) await page.keyboard.press("Shift+ArrowLeft")
  await page.keyboard.press("ControlOrMeta+b")
  await expect(textEditor(page).locator("[data-run]").last()).toHaveCSS("font-weight", "700")
}

export default { name: "text-format-bold", design: "/screens/s43-08-editor-tools-text-format", drive }
