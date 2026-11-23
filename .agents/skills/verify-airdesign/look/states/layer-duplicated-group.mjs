import { shortcutCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, deepPick, drag, nested } from "../doom-canvas.mjs"

async function drive(kit) {
  const { page } = kit
  await nested(kit)
  await deepPick(page, "w:6")
  const from = await centre(page, "w:6")
  await page.keyboard.down(shortcutCopy.chord.other.alt)
  await drag(page, from, { x: from.x, y: from.y + 150 }, 6)
  await page.keyboard.up(shortcutCopy.chord.other.alt)
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
  await expect(page.locator('[data-selection-outline="w:6"]')).toHaveCount(0)
}

export default { name: "layer-duplicated-group", design: editor, drive }
