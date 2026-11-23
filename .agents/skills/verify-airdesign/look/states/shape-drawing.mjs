import { editor } from "../editor-screen.mjs"
import { hold } from "../doom-canvas.mjs"
import { openDoomDeck, slidePoint } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.keyboard.press("r")
  const from = await slidePoint(page, 1000, 240)
  const to = await slidePoint(page, 1600, 540)
  await hold(page, from, to, 12)
}

export default { name: "shape-drawing", design: editor, drive }
