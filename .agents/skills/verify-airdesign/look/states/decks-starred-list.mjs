import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?view=list")
  await kit.page.getByRole("button", { name: "Star Project Atlas" }).click()
  await expect(kit.page.getByRole("button", { name: "Remove star from Project Atlas" })).toBeVisible()
}

export default { name: "decks-starred-list", design: "/screens/s31-03-decks-browse-recents-list", drive }
