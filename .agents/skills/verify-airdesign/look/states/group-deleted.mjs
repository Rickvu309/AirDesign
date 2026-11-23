import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, nested } from "../doom-canvas.mjs"
import { node } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  const at = await centre(page, "w:4")
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('[data-selection-outline="g:1"]')).toBeAttached()
  await page.keyboard.press("Delete")
  await expect(node(page, "g:1")).toHaveCount(0)
}

export default { name: "group-deleted", design: editor, drive }
