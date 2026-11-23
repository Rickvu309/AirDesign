import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  const at = await centre(page, "w:2")
  await page.mouse.move(at.x, at.y)
  await expect(page.locator("[data-slide-box] [data-hover-outline]")).toBeAttached()
}

export default { name: "canvas-hover", design: editor, drive }
