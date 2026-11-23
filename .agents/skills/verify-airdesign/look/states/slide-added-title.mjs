import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { clickSlide, openDoomDeck } from "../doom-deck.mjs"
import { addSlideStart } from "../doom-slides.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  await addSlideStart(page, "Blank")
  await page.keyboard.press("t")
  await clickSlide(page, 160, 120)
  await expect(page.locator('[data-slide-box] [contenteditable="true"]')).toBeFocused()
  await page.keyboard.type("Three levers close the gap", { delay: 0 })
}

export default { name: "slide-added-title", design: editor, drive }
