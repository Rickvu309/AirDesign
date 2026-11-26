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
  const from = await page.locator('[data-editor-grid] [data-slide-entry="1"]').boundingBox()
  const to = await page.locator('[data-editor-grid] [data-slide-entry="4"]').boundingBox()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width * 0.8, to.y + to.height / 2, { steps: 8 })
  await expect(page.locator("[data-drop-bar]")).toBeVisible()
}

export default { name: "grid-slide-drag", design: "/screens/s44-01-editor-grid-fit", drive }
