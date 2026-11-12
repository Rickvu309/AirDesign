import { expect } from "@playwright/test"
import { fixtureDeck } from "./fixture-deck.mjs"

export async function renaming(kit) {
  await fixtureDeck(kit)
  await kit.page.getByRole("button", { name: "Rename deck: clean" }).click()
  await expect(kit.page.getByRole("textbox", { name: "Deck name" })).toBeFocused()
}
