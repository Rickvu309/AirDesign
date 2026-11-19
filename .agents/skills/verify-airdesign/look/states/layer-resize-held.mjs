import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const shape = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await page.locator(shape).click()
  const grip = await page.locator('[data-slide-paint] [data-selection] [data-grip="bottom-right"]').boundingBox()
  if (grip === null) throw new Error("no bottom-right grip")
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(from.x + 60, from.y + 30, { steps: 6 })
  await expect(page.locator("[data-slide-paint] [data-selection]")).toBeVisible()
}

export default { name: "layer-resize-held", design: editor, drive }
