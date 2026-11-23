import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, deepPick, drag, selectMany, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectMany(page, ["w:1", "w:2"])
  await page.keyboard.press("ControlOrMeta+KeyG")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await page.keyboard.press("ControlOrMeta+Alt+KeyG")
  await deepPick(page, "w:1")
  const from = await centre(page, "w:1")
  await drag(page, from, { x: from.x + 90, y: from.y + 60 }, 8)
  await expect(page.locator('[data-selection-outline="w:1"]')).toBeAttached()
}

export default { name: "frame-group-layer-moved", design: editor, drive }
