import { expect } from "@playwright/test"
import { node, openDoomDeck, selected } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { leaveText, placeText, textEditor } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await placeText(page, 192, 885)
  await page.keyboard.type("Source: 2026 field survey", { delay: 0 })
  await leaveText(page)
  const id = await selected(page).first().getAttribute("data-selection-outline")
  await page.keyboard.press("Enter")
  await expect(textEditor(page)).toBeFocused()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Backspace")
  await leaveText(page)
  await expect(node(page, id)).toHaveCount(0)
}

export default { name: "emptied-text-left", design: editor, drive }
