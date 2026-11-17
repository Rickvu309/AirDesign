import { expect } from "@playwright/test"
import { productCopy, starOf, unstarOf } from "../../bin/product-copy.mjs"
import { listDecks } from "../deck-listing.mjs"

async function drive(kit) {
  await listDecks(kit)
  await kit.page.goto("/?view=list")
  const row = kit.page.locator("[data-deck-row]").filter({ hasText: "Project Atlas" })
  await row.click({ button: "right" })
  await kit.page.getByRole("menuitem", { name: starOf("Project Atlas"), exact: true }).click()
  await expect(
    kit.page.getByRole("navigation", { name: productCopy.starred }).getByRole("link", { name: "Project Atlas" }),
  ).toBeVisible()
  await row.click({ button: "right" })
  await expect(kit.page.getByRole("menuitem", { name: unstarOf("Project Atlas"), exact: true })).toBeVisible()
  await kit.page.keyboard.press("Escape")
}

export default { name: "decks-starred-list", design: "/screens/s31-03-decks-browse-recents-list", drive }
