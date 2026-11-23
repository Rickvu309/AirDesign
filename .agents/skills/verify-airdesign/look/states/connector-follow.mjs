import { editor } from "../editor-screen.mjs"
import { centre, connected, hold } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, connected())
  await selectNode(page, "w:1")
  const from = await centre(page, "w:1")
  await hold(page, from, { x: from.x + 40, y: from.y - 60 }, 8)
}

export default { name: "connector-follow", design: editor, drive }
