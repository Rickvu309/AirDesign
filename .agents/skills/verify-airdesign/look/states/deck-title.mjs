import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
}

export default { name: "deck-title", design: editor, drive }
