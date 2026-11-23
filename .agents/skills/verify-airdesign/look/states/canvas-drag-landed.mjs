import { editor } from "../editor-screen.mjs"
import { cards, centre, drag, selectMany } from "../doom-canvas.mjs"
import { openDesign, openDoomDeck } from "../doom-deck.mjs"
import { expect } from "@playwright/test"

const chosen = ["c:5", "c:6", "c:7", "c:8", "c:9", "c:10"]

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, cards())
  await openDesign(page)
  await selectMany(page, chosen)
  const from = await centre(page, "c:5")
  await drag(page, from, { x: from.x - 60, y: from.y - 70 }, 12)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(chosen.length)
}

export default { name: "canvas-drag-landed", design: editor, drive }
