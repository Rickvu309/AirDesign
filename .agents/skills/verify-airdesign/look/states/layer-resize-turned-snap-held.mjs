import path from "node:path"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { openDeck } from "../open-deck.mjs"

const rectangle = '[data-slide-paint] [data-canvas-element="ppt/slides/slide1.xml#4"]'

async function centerOf(locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error("no box")
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await openDeck(page, path.join(kit.repo, "scripts/pptx-fixtures/shapes-added.pptx"))
  await page.locator(rectangle).click()
  const grip = (name) => page.locator(`[data-slide-paint] [data-selection] [data-grip="${name}"]`)
  const middle = await centerOf(page.locator(rectangle))
  const turn = await centerOf(grip("rotate-top-right"))
  const reach = Math.hypot(turn.x - middle.x, turn.y - middle.y)
  const angle = Math.atan2(turn.y - middle.y, turn.x - middle.x) + Math.PI / 2
  await page.mouse.move(turn.x, turn.y)
  await page.keyboard.down("Shift")
  await page.mouse.down()
  await page.mouse.move(middle.x + reach * Math.cos(angle), middle.y + reach * Math.sin(angle), { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up("Shift")
  const top = await centerOf(grip("top"))
  await page.mouse.move(top.x, top.y)
  await page.mouse.down()
  await page.mouse.move(top.x + 58, top.y, { steps: 10 })
  await expect(page.locator('[data-transform-hud="resize"]')).toBeVisible()
}

export default { name: "layer-resize-turned-snap-held", design: editor, drive }
