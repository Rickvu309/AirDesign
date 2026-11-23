import { expect } from "@playwright/test"
import { shapeCopy } from "../../bin/product-copy.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await expect(page.locator("[data-shape-tray]")).toBeVisible()
}

export default { name: "shape-tray", design: "/screens/s43-04-editor-tools-shapes", drive }
