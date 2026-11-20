import { expect } from "@playwright/test"
import { fixtureDeck } from "./fixture-deck.mjs"
import { placeText } from "../bin/text-place.mjs"

export async function selectToneText(kit) {
  await fixtureDeck(kit)
  await selectTwoTextBoxes(kit.page)
}

export async function selectTwoTextBoxes(page) {
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await placeText(page)
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts.last()).toBeFocused()
  await page.keyboard.type("Welcome")
  await page.keyboard.press("Escape")
  await texts.first().click({ position: { x: 8, y: 8 }, modifiers: ["Shift"] })
  await expect(page.locator("[data-chosen]")).toHaveCount(2)
}
