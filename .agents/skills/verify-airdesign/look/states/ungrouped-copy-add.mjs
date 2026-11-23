import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { selectMany, twoShapes } from "../doom-canvas.mjs"
import { clickSlide, openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectMany(page, ["w:1", "w:2"])
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await page.locator('[data-slide-entry="1"]').click()
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(page.locator('[data-slide-entry="2"]')).toHaveAttribute("aria-current", "true")
  await clickSlide(page, 1110, 290)
  await page.keyboard.press("ControlOrMeta+Shift+KeyG")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(2)
  await page.keyboard.press("Escape")
  await page.keyboard.press("r")
  await clickSlide(page, 1700, 160)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
}

export default { name: "ungrouped-copy-add", design: editor, drive }
