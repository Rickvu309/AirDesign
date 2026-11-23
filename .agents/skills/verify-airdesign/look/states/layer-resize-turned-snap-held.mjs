import { editor } from "../editor-screen.mjs"
import { centre, drag, grip, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const middle = await centre(page, "w:1")
  const turn = await grip(page, "rotate-top-right")
  const reach = Math.hypot(turn.x - middle.x, turn.y - middle.y)
  const angle = Math.atan2(turn.y - middle.y, turn.x - middle.x) + Math.PI / 12
  await page.keyboard.down("Shift")
  await drag(page, turn, { x: middle.x + reach * Math.cos(angle), y: middle.y + reach * Math.sin(angle) }, 10)
  await page.keyboard.up("Shift")
  const top = await grip(page, "top")
  await hold(page, top, { x: top.x + 20, y: top.y - 40 }, 10)
}

export default { name: "layer-resize-turned-snap-held", design: editor, drive }
