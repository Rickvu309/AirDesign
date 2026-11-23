import { expect } from "@playwright/test"
import { openDoomDeck } from "./doom-deck.mjs"

export async function renaming(kit) {
  await openDoomDeck(kit)
  await kit.page.getByRole("button", { name: "Rename deck: Blank deck" }).click()
  await expect(kit.page.getByRole("textbox", { name: "Deck name" })).toBeFocused()
}
