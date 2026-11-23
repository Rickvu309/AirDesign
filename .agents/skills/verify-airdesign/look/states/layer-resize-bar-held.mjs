import { editor } from "../editor-screen.mjs"
import { grip, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const top = await grip(page, "top")
  const from = await grip(page, "bottom")
  await hold(page, from, { x: from.x, y: top.y + 5 }, 12)
}

export default { name: "layer-resize-bar-held", design: editor, drive }
