import { editor } from "../editor-screen.mjs"
import { grip, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const from = await grip(page, "bottom-right")
  await page.keyboard.down("Shift")
  await hold(page, from, { x: from.x + 60, y: from.y + 30 }, 6)
}

export default { name: "layer-resize-held", design: editor, drive }
