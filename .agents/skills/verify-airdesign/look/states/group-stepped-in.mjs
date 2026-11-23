import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, nested } from "../doom-canvas.mjs"
import { openDesign } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  await openDesign(page)
  const at = await centre(page, "w:4")
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('[data-selection-outline="g:1"]')).toBeAttached()
  await page.mouse.dblclick(at.x, at.y)
  await expect(page.locator('[data-selection-outline="g:2"]')).toBeAttached()
  await page.mouse.move(4, 4)
}

export default { name: "group-stepped-in", design: editor, drive }
