import { editor } from "../editor-screen.mjs"
import { selectMany, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  await openDoomDeck(kit, twoShapes)
  await selectMany(kit.page, ["w:1", "w:2"])
}

export default { name: "two-selected", design: editor, drive }
