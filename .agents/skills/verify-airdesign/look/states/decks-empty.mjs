import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await expect(kit.page.getByRole("heading", { name: productCopy.noDecksTitle })).toBeVisible()
}

export default { name: "decks-empty", design: "/screens/s31-01-decks-browse-empty-first-visit", drive }
