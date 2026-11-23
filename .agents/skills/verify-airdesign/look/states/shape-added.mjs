import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { shapeCopy } from "../../bin/product-copy.mjs"
import { pickShape } from "../doom-canvas.mjs"
import { clickSlide, dragSlide, openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  const shapes = page.locator("[data-slide-box] [data-node]")
  const before = await shapes.count()
  await pickShape(page, shapeCopy.shapes.square)
  await clickSlide(page, 1000, 760)
  await pickShape(page, shapeCopy.shapes.circle)
  await clickSlide(page, 1240, 760)
  await pickShape(page, shapeCopy.line)
  await dragSlide(page, { x: 1460, y: 810 }, { x: 1800, y: 810 })
  await expect(shapes).toHaveCount(before + 3)
  await page.mouse.move(4, 4)
}

export default { name: "shape-added", design: editor, drive }
