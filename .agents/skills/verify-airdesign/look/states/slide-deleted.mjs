import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { threeSlideDeck } from "../three-slide-deck.mjs"

async function drive(kit) {
  await threeSlideDeck(kit)
  await kit.page.locator('[data-slide-entry="2"]').click({ button: "right" })
  await kit.page.getByRole("menuitem", { name: /Delete/ }).click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(2)
}

export default { name: "slide-deleted", design: editor, drive }
