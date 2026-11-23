import { editor } from "../editor-screen.mjs"
import { centre, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, slidePoint } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  const from = await centre(page, "w:2")
  const target = await slidePoint(page, 1110 + 6, 710 - 4)
  await hold(page, from, target, 10)
}

export default { name: "layer-snap-held", design: editor, drive }
