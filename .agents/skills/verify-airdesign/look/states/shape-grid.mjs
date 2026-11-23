import { expect } from "@playwright/test"
import { shapeCopy } from "../../bin/product-copy.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.more, exact: true }).click()
  await expect(page.locator("[data-shape-grid]")).toBeVisible()
}

export default { name: "shape-grid", design: null, drive }
