import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?q=plan")
  await expect(kit.page.getByRole("heading", { name: "Hiring Plan", level: 2 })).toBeVisible()
}

export default { name: "decks-search-match", design: "/screens/s31-02-decks-browse-recents-grid", drive }
