import { expect } from "@playwright/test"
import { shapeCopy } from "../../bin/product-copy.mjs"
import { pickShape } from "../doom-canvas.mjs"
import { clickSlide, dragSlide, openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  const shapes = page.locator("[data-slide-box] [data-node]")
  const before = await shapes.count()
  await pickShape(page, shapeCopy.line)
  await dragSlide(page, { x: 1000, y: 760 }, { x: 1500, y: 760 })
  await pickShape(page, shapeCopy.shapes.square)
  await clickSlide(page, 1600, 760)
  await expect(shapes).toHaveCount(before + 2)
  await page.mouse.move(4, 4)
}

export default { name: "shape-after-line", design: null, drive }
