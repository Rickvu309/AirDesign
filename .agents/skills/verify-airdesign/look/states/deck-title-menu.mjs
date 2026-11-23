import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: "Blank deck actions" }).click()
  await expect(kit.page.getByRole("menuitem", { name: "Rename" })).toBeVisible()
}

export default { name: "deck-title-menu", design: editor, drive }
