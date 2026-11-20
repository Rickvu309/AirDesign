import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/census-updating-spm.pptx"))
  await page.keyboard.press("Shift+R")
  const stage = await page.locator("[data-canvas-stage]").boundingBox()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  await expect(page.locator("[data-slide-paint]")).toBeVisible()
  await page.mouse.move(slide.x + 300, stage.y + 10)
  await page.mouse.down()
  await page.mouse.move(slide.x + 300, slide.y + slide.height * 0.62, { steps: 8 })
}

export default { name: "canvas-guide-drag", design: editor, drive }
