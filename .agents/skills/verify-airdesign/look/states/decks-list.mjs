import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?view=list")
  await expect(kit.page.getByRole("link", { name: "Brand Refresh" })).toBeVisible()
}

export default { name: "decks-list", design: "/screens/s31-03-decks-browse-recents-list", drive }
