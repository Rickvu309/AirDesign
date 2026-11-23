import { editor } from "../editor-screen.mjs"
import { grip, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:2")
  const from = await grip(page, "right")
  await page.keyboard.down("Alt")
  await hold(page, from, { x: from.x + 40, y: from.y }, 10)
}

export default { name: "layer-resize-centre-snap-held", design: editor, drive }
