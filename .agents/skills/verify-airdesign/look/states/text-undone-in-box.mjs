import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { node } from "../doom-deck.mjs"
import { titleEdited } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await titleEdited(kit)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.type("Mine", { delay: 40 })
  await page.keyboard.press("ControlOrMeta+z")
  await expect(node(page, "s:4")).not.toHaveText("Mine")
}

export default { name: "text-undone-in-box", design: editor, drive }
