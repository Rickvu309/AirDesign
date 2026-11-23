import { expect } from "@playwright/test"
import { clickSlide } from "../doom-deck.mjs"
import { designing, element } from "../doom-design.mjs"

async function drive(kit) {
  const { page } = kit
  await designing(kit)
  await page.keyboard.press("o")
  await clickSlide(page, 1300, 420)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await expect(page.locator("[data-selection-colors]")).toBeVisible()
}

export default { name: "selection-color-target", design: element, drive }
