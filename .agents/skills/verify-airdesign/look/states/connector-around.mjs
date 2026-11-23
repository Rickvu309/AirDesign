import { editor } from "../editor-screen.mjs"
import { centre, connected, hold } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode, slidePoint } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, connected())
  await selectNode(page, "w:1")
  const from = await centre(page, "w:1")
  const to = await slidePoint(page, 1240, 940)
  await hold(page, from, to, 8)
}

export default { name: "connector-around", design: editor, drive }
