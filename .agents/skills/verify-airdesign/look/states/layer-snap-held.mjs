import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const ellipse = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#5"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await expect(page.locator(ellipse)).toBeVisible()
  const slide = await page.locator("[data-slide-paint]").boundingBox()
  const from = { x: slide.x + 360, y: slide.y + 150 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y + 137, { steps: 10 })
  await expect(page.locator(ellipse)).toHaveCSS("left", "290px")
}

export default { name: "layer-snap-held", design: editor, drive }
