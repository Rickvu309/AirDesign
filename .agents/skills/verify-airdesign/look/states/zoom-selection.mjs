import { expect } from "@playwright/test"
import { selectNode } from "../doom-deck.mjs"
import { openTextBoxDeck, textBox } from "../doom-text-box.mjs"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await openTextBoxDeck(kit)
  const readout = page.locator("[data-zoom-readout]")
  const fitted = await readout.textContent()
  await selectNode(page, textBox)
  await page.keyboard.press("Shift+Digit2")
  await expect(readout).not.toHaveText(fitted ?? "")
}

export default { name: "zoom-selection", design: editor, drive }
