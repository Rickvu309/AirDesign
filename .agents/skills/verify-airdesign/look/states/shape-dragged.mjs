import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, drag, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  const from = await centre(page, "w:1")
  await drag(page, from, { x: from.x - 120, y: from.y + 170 }, 8)
  await expect(page.locator('[data-selection-outline="w:1"]')).toBeAttached()
}

export default { name: "shape-dragged", design: editor, drive }
