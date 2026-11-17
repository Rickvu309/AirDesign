import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator('[data-slide-entry="2"]').click({ button: "right" })
  await expect(kit.page.getByRole("menu")).toBeVisible()
}

export default { name: "slide-actions-menu", design: editor, drive }
