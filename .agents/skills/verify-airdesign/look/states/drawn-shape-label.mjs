import { createRequire } from "node:module"
import { join } from "node:path"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page, expect, repo } = kit
  const require = createRequire(import.meta.url)
  const { shapeCopy } = require(join(repo, "apps/web/src/copy/shape-copy.ts"))
  await fixtureDeck(kit, "clean.pptx")
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const count = await layers.count()
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.square, exact: true }).click()
  await expect(layers).toHaveCount(count + 1)
  const layer = layers.last()
  await layer.dblclick()
  await expect(layer.locator('[contenteditable="true"]')).toBeFocused()
  await page.keyboard.type("Shape label")
}

export default { name: "drawn-shape-label", design: "/screens/s43-09-editor-tools-design-element", drive }
