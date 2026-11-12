import { expect } from "@playwright/test"
import { newBlankDeck } from "../bin/new-deck.mjs"

export async function threeSlideDeck(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await newBlankDeck(kit.page)
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(1)
  const add = kit.page.getByRole("button", { name: "Add slide" }).first()
  await add.click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(2)
  await add.click()
  await expect(kit.page.locator("[data-slide-entry]")).toHaveCount(3)
}
