import { expect } from "@playwright/test"
import { slideListCopy } from "../../bin/product-copy.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entries } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await addSlides(page, 5)
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(entries(page)).toHaveCount(6)
  await page.locator('[data-editor-grid] [data-slide-entry="4"]').click({ button: "right" })
  await expect(page.getByRole("menu")).toBeVisible()
}

export default { name: "grid-slide-menu", design: "/screens/s44-04-editor-grid-slide-menu", drive }
