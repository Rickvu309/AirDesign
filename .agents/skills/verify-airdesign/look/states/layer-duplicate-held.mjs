import { shortcutCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, hold, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const from = await centre(page, "w:1")
  await page.keyboard.down(shortcutCopy.chord.other.alt)
  await hold(page, from, { x: from.x + 40, y: from.y + 150 }, 10)
  await expect(page.locator('[data-selection-outline="w:1"]')).toHaveCount(0)
}

export default { name: "layer-duplicate-held", design: editor, drive }
