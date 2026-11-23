import { expect } from "@playwright/test"
import { openDoomDeck } from "./doom-deck.mjs"

export async function threeSlideDeck(kit) {
  const opened = await openDoomDeck(kit)
  const entries = kit.page.locator("[data-slide-entry]")
  await expect(entries).toHaveCount(1)
  const add = kit.page.getByRole("button", { name: "Add slide" }).first()
  await add.click()
  await expect(entries).toHaveCount(2)
  await add.click()
  await expect(entries).toHaveCount(3)
  return opened
}
