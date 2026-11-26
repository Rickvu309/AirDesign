import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  await openDoomDeck(kit)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  const name = kit.page.getByRole("button", { name: /^Rename deck:/ })
  await name.click()
  await kit.page.getByRole("textbox", { name: productCopy.deckName }).press("Enter")
  await expect(name).toBeFocused()
}

export default { name: "deck-title-renamed", design: editor, drive }
