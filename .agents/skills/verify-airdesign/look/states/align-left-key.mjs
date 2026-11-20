import { shapeCopy, transitionCopy } from "../../bin/product-copy.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page, expect } = kit
  await fixtureDeck(kit, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const count = await layers.count()
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(layers).toHaveCount(count + 1)
  await layers.first().click()
  await page.keyboard.press("ControlOrMeta+KeyA")
  await page.keyboard.press("Alt+KeyA")
}

export default { name: "align-left-key", design: "/screens/s43-09-editor-tools-design-element", drive }
