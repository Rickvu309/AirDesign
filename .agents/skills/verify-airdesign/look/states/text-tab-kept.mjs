import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { placeText, textEditor } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await placeText(page, 384, 860)
  await page.keyboard.type("Revenue")
  await page.keyboard.press("Tab")
  await page.keyboard.type(" grew")
  await expect(textEditor(page)).toBeFocused()
  await expect(textEditor(page)).toContainText("Revenue")
}

export default { name: "text-tab-kept", design: editor, drive }
