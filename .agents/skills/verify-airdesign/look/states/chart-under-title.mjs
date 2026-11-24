import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.getByRole("button", { name: editorCopy.actions, exact: true }).click()
  await page.getByRole("option", { name: editorCopy.chartKinds.column, exact: true }).click()
  await expect(page.locator("[data-slide-box] svg").first()).toBeVisible()
  await page.mouse.move(4, 4)
}

export default { name: "chart-under-title", design: null, drive }
