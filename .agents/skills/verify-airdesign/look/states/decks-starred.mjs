import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/")
  for (const name of ["Project Atlas", "Q3 Investor Update", "FY26 Operating Plan"]) {
    await kit.page.getByRole("button", { name: `Star ${name}` }).click()
  }
  const starred = kit.page.getByRole("navigation", { name: "Starred" })
  await expect(starred.getByRole("link")).toHaveCount(3)
}

export default { name: "decks-starred", design: "/screens/s31-02-decks-browse-recents-grid", drive }
