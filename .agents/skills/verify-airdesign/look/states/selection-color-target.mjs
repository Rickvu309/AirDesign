import { createRequire } from "node:module"
import { join } from "node:path"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page, expect, repo } = kit
  const require = createRequire(import.meta.url)
  const { shapeCopy } = require(join(repo, "apps/web/src/copy/shape-copy.ts"))
  const { transitionCopy } = require(join(repo, "apps/web/src/copy/transition-copy.ts"))
  await fixtureDeck(kit, "clean.pptx")
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  const layers = page.locator("[data-slide-paint] [data-canvas-element]")
  const count = await layers.count()
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: shapeCopy.shapes.circle, exact: true }).click()
  await page.keyboard.press("Enter")
  await expect(layers).toHaveCount(count + 1)
  await layers.last().click()
  await expect(page.locator("[data-selection-colors]")).toBeVisible()
}

export default { name: "selection-color-target", design: "/screens/s43-09-editor-tools-design-element", drive }
