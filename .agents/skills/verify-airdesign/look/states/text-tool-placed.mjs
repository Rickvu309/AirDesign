import { expect } from "@playwright/test"
import { dragSlide, openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText, textEditor } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await placeText(page, 160, 160)
  await page.keyboard.type("Costs fall 12% with two shifts", { delay: 0 })
  await leaveText(page)
  await page.keyboard.press("Escape")
  await page.keyboard.press("t")
  await dragSlide(page, { x: 160, y: 760 }, { x: 860, y: 900 })
  await expect(textEditor(page)).toBeFocused()
  await page.keyboard.type("A box drawn with the Text tool keeps its width and wraps the words inside it", {
    delay: 0,
  })
  await leaveText(page)
}

export default { name: "text-tool-placed", design: editor, drive }
