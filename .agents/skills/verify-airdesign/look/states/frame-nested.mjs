import { editor } from "../editor-screen.mjs"
import { nestedFrames } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, nestedFrames)
  await selectNode(page, "f:1", { position: { x: 12, y: 12 } })
  await page.mouse.move(4, 4)
}

export default { name: "frame-nested", design: editor, drive }
