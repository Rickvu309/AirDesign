import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"
import { shortcutCopy } from "../bin/product-copy.mjs"
import { placeText } from "../bin/text-place.mjs"

export async function namedSlides(page, count) {
  await newBlankDeck(page)
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const entries = page.locator("[data-slide-list] [data-slide-entry]")
  for (let number = 1; number <= count; number += 1) {
    if (number > 1) await page.getByRole("button", { name: "Add slide", exact: true }).click()
    await expect(entries).toHaveCount(number)
    await placeText(page)
    const title = page.locator('[data-slide-paint] [contenteditable="true"]').first()
    await expect(title).toBeFocused()
    await title.pressSequentially(`Chapter ${String(number)} of the story`, { delay: 0 })
    await page.keyboard.press("Escape")
    await page.keyboard.press("Escape")
  }
  return entries
}

export function entryOf(page, number) {
  return page.locator(`[data-slide-list] [data-slide-entry="${String(number)}"]`)
}

export async function selectTwoToFour(page) {
  await entryOf(page, 2).click()
  await expect(entryOf(page, 2)).toHaveAttribute("aria-current", "true")
  await entryOf(page, 4).click({ modifiers: [shortcutCopy.chord.other.shift] })
}
