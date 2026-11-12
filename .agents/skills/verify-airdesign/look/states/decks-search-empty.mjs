import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?q=quarterly")
  await expect(kit.page.getByRole("heading", { name: "No decks match “quarterly”" })).toBeVisible()
}

export default { name: "decks-search-empty", design: null, drive }
