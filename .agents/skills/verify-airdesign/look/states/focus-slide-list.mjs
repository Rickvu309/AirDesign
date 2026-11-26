import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator('[data-slide-entry="1"]').focus()
  await kit.page.keyboard.press("Shift+Tab")
  await kit.page.keyboard.press("Tab")
  await kit.page.keyboard.press("ArrowDown")
  const entry = kit.page.locator('[data-slide-entry="2"]')
  await expect(entry).toBeFocused()
  await expect(entry).toHaveCSS("outline-style", "solid")
}

export default { name: "focus-slide-list", design: editor, drive }
