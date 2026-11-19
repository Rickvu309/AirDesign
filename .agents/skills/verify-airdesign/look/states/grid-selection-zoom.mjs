import { expect } from "@playwright/test"
import { openGroupDeck } from "../grid-group-add.mjs"

async function drive(kit) {
  await openGroupDeck(kit, 7)
  const { page } = kit
  await page.locator('[data-slide-entry="1"] [data-thumb-node]').first().click()
  await expect(page.locator("[data-grid-edit] [data-selection]").first()).toBeVisible()
  await page.keyboard.press("Shift+Digit2")
}

export default { name: "grid-selection-zoom", design: "/screens/s41-01-editor-grid-default", drive }
