import path from "node:path"
import { expect } from "@playwright/test"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, path.join(kit.repo, "scripts/pptx-fixtures/census-updating-spm.pptx"), 5)
  await expect(kit.page.locator('[data-slide-paint] [data-canvas-element="ppt/slides/slide5.xml#6"]')).toBeVisible()
  await kit.page.evaluate(() => document.fonts.ready)
}

export default { name: "slide-diagram", design: null, drive }
