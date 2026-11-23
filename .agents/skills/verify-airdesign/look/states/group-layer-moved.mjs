import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, deepPick, drag, nested } from "../doom-canvas.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  await deepPick(page, "w:4")
  const from = await centre(page, "w:4")
  await drag(page, from, { x: from.x + 120, y: from.y + 40 }, 8)
  await expect(page.locator('[data-selection-outline="w:4"]')).toBeAttached()
}

export default { name: "group-layer-moved", design: editor, drive }
