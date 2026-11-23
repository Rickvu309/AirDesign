import { editor } from "../editor-screen.mjs"
import { grip, hold, selectMany, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectMany(page, ["w:1", "w:2"])
  const from = await grip(page, "bottom-right")
  await hold(page, from, { x: from.x + 50, y: from.y + 13 }, 10)
}

export default { name: "layers-resize-snap-held", design: editor, drive }
