import { expect } from "@playwright/test"
import { fixtureDeck } from "./fixture-deck.mjs"

export async function nestedList(kit) {
  const { page } = kit
  await fixtureDeck(kit)
  const text = page.locator('[data-slide-paint] [contenteditable="true"]')
  await text.click()
  await text.press("ControlOrMeta+End")
  for (const line of ["Two", "Three"]) {
    await page.keyboard.press("Enter")
    await page.keyboard.type(line)
  }
  await text.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+Shift+Digit8")
  const items = text.locator("[data-paragraph]")
  await expect(items).toHaveCount(3)
  await items.nth(1).click()
  await page.keyboard.press("Tab")
  await expect(items.nth(1)).toHaveAttribute("data-level", "1")
  await items.nth(2).click()
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(items.nth(2)).toHaveAttribute("data-level", "2")
  return items
}
