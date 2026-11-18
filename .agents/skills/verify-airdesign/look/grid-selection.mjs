import { expect } from "@playwright/test"
import { openRowDeck } from "./grid-row-add.mjs"

export async function selectSlides(kit) {
  const account = await openRowDeck(kit, 7)
  const number = kit.page.locator("[data-slide-number]")
  await number.nth(0).click()
  await number.nth(2).click({ modifiers: ["Shift"] })
  await expect(kit.page.locator("[data-slide-entry][data-selected]")).toHaveCount(3)
  return account
}
