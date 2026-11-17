import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.trash.path,
    (route) => route.abort(),
  )
  await kit.page.goto("/")
  await kit.page.getByRole("button", { name: "Pricing Strategy Review actions" }).click()
  const failed = kit.page.waitForEvent("requestfailed")
  await kit.page.getByRole("menuitem", { name: productCopy.moveToTrash }).click()
  await failed
  await expect(kit.page.getByRole("menu")).toHaveCount(0)
  await kit.page
    .getByText("Unable to move Pricing Strategy Review to Trash", { exact: true })
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
}

export default { name: "trash-move-failed", design: "/screens/s33-01-decks-trash-deck-moved-toast", drive }
