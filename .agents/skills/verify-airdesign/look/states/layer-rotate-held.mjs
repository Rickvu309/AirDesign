import { editor } from "../editor-screen.mjs"
import { centre, grip, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const middle = await centre(page, "w:1")
  const from = await grip(page, "rotate-top-right")
  await page.keyboard.down("Shift")
  await hold(page, from, { x: middle.x + 120, y: middle.y + 20 }, 8)
}

export default { name: "layer-rotate-held", design: editor, drive }
