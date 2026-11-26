import { expect } from "@playwright/test"
import { slideListCopy } from "../../bin/product-copy.mjs"
import { accent, openDoomDeck, spot } from "../doom-deck.mjs"
import { addSlides, entries } from "../doom-slides.mjs"

const layers = [
  { id: "g:1", props: { box: spot(1100, 150, 300, 150), fills: accent } },
  { id: "g:2", props: { box: spot(1500, 150, 300, 150), fills: accent } },
  { id: "g:3", props: { box: spot(1100, 750, 300, 150), fills: accent } },
]

async function onSlide(page, x, y) {
  const frame = await page.locator('[data-editor-grid] [data-slide-entry="1"]').boundingBox()
  return { x: frame.x + (frame.width * x) / 1920, y: frame.y + (frame.height * y) / 1080 }
}

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, layers)
  await addSlides(page, 1)
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(entries(page)).toHaveCount(2)
  await page.locator('[data-editor-grid] [data-node="g:1"]').click()
  await expect(page.locator("[data-editor-grid] [data-grid-edit]")).toHaveCount(1)
  const from = await onSlide(page, 1000, 1020)
  const to = await onSlide(page, 1560, 260)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await expect(page.locator("[data-editor-grid] [data-marquee]").first()).toBeAttached()
}

export default { name: "grid-layer-box", design: "/screens/s44-01-editor-grid-fit", drive }
