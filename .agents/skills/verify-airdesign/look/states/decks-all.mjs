import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/all")
  await expect(kit.page.getByRole("heading", { name: "All decks", level: 1 })).toBeVisible()
  await expect(kit.page.getByRole("heading", { name: "Brand Refresh", level: 2 })).toBeVisible()
}

export default { name: "decks-all", design: "/screens/s31-04-decks-browse-all-decks-grid", drive }
