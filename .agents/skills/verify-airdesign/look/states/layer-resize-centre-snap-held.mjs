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
  await page.locator(ellipse).click()
  const grip = await page.locator('[data-slide-paint] [data-selection] [data-grip="right"]').boundingBox()
  if (grip === null) throw new Error("no right grip")
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down("Alt")
  await page.mouse.down()
  await page.mouse.move(from.x + 88, from.y, { steps: 10 })
  await expect(page.locator('[data-transform-hud="resize"]')).toBeVisible()
}

export default { name: "layer-resize-centre-snap-held", design: editor, drive }
