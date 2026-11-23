import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, deepPick, drag, grip, nested } from "../doom-canvas.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  await deepPick(page, "w:4")
  const middle = await centre(page, "w:4")
  const from = await grip(page, "rotate-top-right")
  const angle = Math.PI / 4
  const [dx, dy] = [from.x - middle.x, from.y - middle.y]
  await drag(page, from, {
    x: middle.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: middle.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  })
  await expect(page.locator('[data-selection-outline="w:4"]')).toBeAttached()
}

export default { name: "group-layer-turned", design: editor, drive }
