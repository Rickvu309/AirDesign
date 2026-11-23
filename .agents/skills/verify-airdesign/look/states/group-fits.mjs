import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, deepPick, drag, grip, nested } from "../doom-canvas.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  await deepPick(page, "w:4")
  const from = await grip(page, "right")
  await drag(page, from, { x: from.x + 40, y: from.y + 23 })
  await page.keyboard.press("Escape")
  await page.keyboard.press("Escape")
  const at = await centre(page, "w:6")
  await page.mouse.click(at.x, at.y)
  await expect(page.locator('[data-selection-outline="g:1"]')).toBeAttached()
}

export default { name: "group-fits", design: editor, drive }
