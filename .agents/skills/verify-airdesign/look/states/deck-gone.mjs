import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/s/gone-deck")
  await expect(kit.page.getByRole("heading", { name: "Deck not found" })).toBeVisible()
}

export default { name: "deck-gone", design: "/screens/s34-01-decks-not-found-deck", drive }
