import { expect } from "@playwright/test"
import { shortcutCopy, slideListCopy } from "../../bin/product-copy.mjs"
import { solid } from "../doom-canvas.mjs"
import { openDoomDeck, spot } from "../doom-deck.mjs"
import { addSlides, entries } from "../doom-slides.mjs"

const layers = [
  { id: "o:1", props: { box: spot(1300, 600, 400, 250), geometry: { kind: "rect" }, fills: solid("accent3") } },
  { id: "o:2", props: { box: spot(1300, 150, 300, 200), geometry: { kind: "ellipse" }, fills: solid("accent2") } },
]

async function onSlide(page, number, x, y) {
  const frame = await page.locator(`[data-editor-grid] [data-slide-entry="${number}"]`).boundingBox()
  return { x: frame.x + (frame.width * x) / 1920, y: frame.y + (frame.height * y) / 1080 }
}

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, layers)
  await addSlides(page, 1)
  await page.getByRole("button", { name: slideListCopy.gridView }).click()
  await expect(entries(page)).toHaveCount(2)
  const rectangle = await onSlide(page, 1, 1500, 725)
  const ellipse = await onSlide(page, 1, 1450, 250)
  await page.mouse.click(rectangle.x, rectangle.y)
  await page.keyboard.down(shortcutCopy.chord.other.shift)
  await page.mouse.click(ellipse.x, ellipse.y)
  await page.keyboard.up(shortcutCopy.chord.other.shift)
  await expect(page.locator("[data-editor-grid] [data-grid-edit] [data-selection-outline]")).toHaveCount(2)
  await page.mouse.move(rectangle.x, rectangle.y)
  await page.mouse.down()
  const over = await onSlide(page, 2, 700, 700)
  await page.mouse.move(over.x, over.y, { steps: 14 })
  await expect(page.locator("[data-editor-grid] [data-grid-edit]")).toHaveCount(1)
}

export default { name: "grid-layer-carry", design: "/screens/s44-01-editor-grid-fit", drive }
