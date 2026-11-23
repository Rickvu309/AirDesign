import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { autoRow, centre } from "../doom-canvas.mjs"
import { openDesign, openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, autoRow())
  await openDesign(page)
  const at = await centre(page, "w:2")
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('[data-selection-outline="f:1"]')).toBeAttached()
  await page.mouse.dblclick(at.x, at.y)
  await expect(page.locator('[data-selection-outline="w:2"]')).toBeAttached()
  await page.mouse.move(4, 4)
}

export default { name: "frame-auto-child", design: editor, drive }
