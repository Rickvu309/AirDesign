import { expect } from "@playwright/test"
import { node } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, titleEdited } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await titleEdited(kit)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.insertText("Mine")
  await leaveText(page)
  await expect(node(page, "s:4")).toHaveText("Mine")
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, "s:4")).toHaveText("Untitled")
}

export default { name: "text-undone", design: editor, drive }
