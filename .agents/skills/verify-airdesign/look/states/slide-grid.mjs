import { expect } from "@playwright/test"
import { slideListCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"
import { addSlides, entries, entry } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await addSlides(page, 8)
  await entry(page, 4).click()
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(page.locator("[data-slide-grid]")).toBeVisible()
  await expect(entries(page)).toHaveCount(9)
  await expect(entry(page, 4)).toHaveAttribute("aria-current", "true")
}

export default { name: "slide-grid", design: editor, drive }
