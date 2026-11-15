import { expect } from "@playwright/test"
import { newBlankDeck } from "../../bin/new-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  await kit.page.getByRole("button", { name: "Shapes", exact: true }).click()
  await kit.page.getByRole("button", { name: "More shapes", exact: true }).click()
  await expect(kit.page.locator("[data-shape-grid]")).toBeVisible()
}

export default { name: "shape-grid", design: null, drive }
