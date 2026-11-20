import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const shape = (number) => `[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#${String(number)}"]`

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await page.locator(shape(4)).click()
  await page.locator(shape(5)).click({ modifiers: ["Shift"] })
  const grip = await page.locator('[data-selection-around="2"] [data-grip="bottom-right"]').boundingBox()
  if (grip === null) throw new Error("no bottom-right grip")
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 88, from.y + 13, { steps: 10 })
  await expect(page.locator('[data-transform-hud="resize"]')).toBeVisible()
}

export default { name: "layers-resize-snap-held", design: editor, drive }
