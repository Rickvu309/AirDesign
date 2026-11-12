import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator('[data-slide-entry="1"]').focus()
  await kit.page.keyboard.press("ArrowDown")
  await kit.page.locator('[data-slide-entry="2"]').focus()
  await expect(kit.page.locator('[data-slide-entry="2"]')).toBeFocused()
}

export default { name: "focus-slide-list", design: editor, drive }
