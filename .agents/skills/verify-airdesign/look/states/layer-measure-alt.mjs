import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  await page.mouse.click(slide.x + 360, slide.y + 150)
  await expect(page.locator("[data-slide-paint] [data-selection]")).toHaveCount(1)
  await page.keyboard.down("Alt")
  await page.mouse.move(slide.x + 150, slide.y + 150)
}

export default { name: "layer-measure-alt", design: editor, drive }
