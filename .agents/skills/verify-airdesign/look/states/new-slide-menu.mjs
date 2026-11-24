import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { entries } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await expect(entries(page)).toHaveCount(1)
  await page.getByRole("button", { name: "Choose a layout for the new slide", exact: true }).click()
  await expect(page.getByRole("menuitem")).toHaveCount(8)
  if ((await page.locator("[data-layout-menu]").count()) > 0) {
    await expect(page.locator("[data-layout-thumb] [data-slide-paint]")).toHaveCount(8)
    await expect(page.locator("[data-layout-thumb] [data-fonts-pending]")).toHaveCount(0)
  }
}

export default { name: "new-slide-menu", design: editor, drive }
