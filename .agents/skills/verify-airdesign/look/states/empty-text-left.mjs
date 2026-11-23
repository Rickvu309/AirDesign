import { openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await placeText(page, 192, 160)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 0 })
  await leaveText(page)
  await page.keyboard.press("Escape")
  await placeText(page, 192, 860)
  await leaveText(page)
}

export default { name: "empty-text-left", design: editor, drive }
