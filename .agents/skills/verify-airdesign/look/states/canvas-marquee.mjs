import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, slidePoint } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  const from = await slidePoint(page, 1880, 40)
  const to = await slidePoint(page, 1200, 330)
  await hold(page, from, to, 6)
  await expect(page.locator("[data-slide-box] [data-marquee]")).toBeAttached()
  await expect(page.locator('[data-selection-outline="w:1"]')).toBeAttached()
}

export default { name: "canvas-marquee", design: editor, drive }
