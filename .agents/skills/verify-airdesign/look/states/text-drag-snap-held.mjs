import { openDoomDeck, slidePoint } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await placeText(page, 192, 160)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 0 })
  await leaveText(page)
  await page.keyboard.press("Escape")
  await page.keyboard.press("t")
  const start = await slidePoint(page, 198, 760)
  const middle = await slidePoint(page, 576, 860)
  const end = await slidePoint(page, 954, 900)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(middle.x, middle.y, { steps: 4 })
  await page.mouse.move(end.x, end.y, { steps: 4 })
}

export default { name: "text-drag-snap-held", design: editor, drive }
