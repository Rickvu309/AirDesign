import { editor } from "../editor-screen.mjs"
import { autoRow, grip, hold } from "../doom-canvas.mjs"
import { openDesign, openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, autoRow({ w: "fill", h: "fixed" }))
  await openDesign(page)
  await selectNode(page, "f:1", { position: { x: 12, y: 12 } })
  const from = await grip(page, "right")
  await hold(page, from, { x: from.x + 60, y: from.y }, 12)
}

export default { name: "frame-fill-resizing", design: editor, drive }
