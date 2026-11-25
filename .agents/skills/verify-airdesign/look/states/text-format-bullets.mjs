import { expect } from "@playwright/test"
import { spot } from "../doom-deck.mjs"
import { editText, textEditor, textLayer } from "../doom-text.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    textLayer("t:1", "Costs fall 12%\nTwo shifts cover the peak\nHiring pauses in Q3", spot(160, 760, 1200, 220)),
  ])
  await editText(page, "t:1")
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+Shift+8")
  await expect(textEditor(page).locator("[data-label]").first()).toBeVisible()
}

export default { name: "text-format-bullets", design: "/screens/s43-08-editor-tools-text-format", drive }
