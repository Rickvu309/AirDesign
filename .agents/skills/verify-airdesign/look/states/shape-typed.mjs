import { expect } from "@playwright/test"
import { dragSlide, openDoomDeck } from "../doom-deck.mjs"
import { editor } from "../editor-screen.mjs"
import { textEditor } from "../doom-text.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await page.keyboard.press("r")
  await dragSlide(page, { x: 1100, y: 200 }, { x: 1520, y: 440 })
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await page.keyboard.press("Enter")
  await expect(textEditor(page)).toBeFocused()
  await page.keyboard.type("Sales up", { delay: 0 })
}

export default { name: "shape-typed", design: editor, drive }
