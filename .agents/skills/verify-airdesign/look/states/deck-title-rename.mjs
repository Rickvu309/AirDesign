import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: /^Rename deck:/ }).click()
  await expect(kit.page.getByRole("textbox", { name: productCopy.deckName })).toBeFocused()
}

export default { name: "deck-title-rename", design: editor, drive }
