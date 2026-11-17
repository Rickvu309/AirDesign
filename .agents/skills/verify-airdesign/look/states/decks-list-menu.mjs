import { expect } from "@playwright/test"
import { productCopy } from "../../../../../apps/web/src/copy/product-copy.ts"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?view=list")
  await kit.page.locator("[data-deck-row]").first().click({ button: "right" })
  await expect(kit.page.getByRole("menuitem", { name: productCopy.moveToTrash })).toBeVisible()
}

export default { name: "decks-list-menu", design: null, drive }
