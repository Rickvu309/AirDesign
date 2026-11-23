import { shortcutCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { centre, drag, selectedIds, twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  const from = await centre(page, "w:1")
  await page.keyboard.down(shortcutCopy.chord.other.alt)
  await drag(page, from, { x: from.x + 40, y: from.y + 150 }, 10)
  await page.keyboard.up(shortcutCopy.chord.other.alt)
  const [copy] = await selectedIds(page)
  expect(copy).not.toBe("w:1")
  await page.keyboard.press("ControlOrMeta+KeyD")
  await expect(page.locator(`[data-selection-outline="${copy}"]`)).toHaveCount(0)
  await expect(page.locator("[data-slide-box] [data-node]")).toHaveCount(6)
}

export default { name: "layer-duplicated", design: editor, drive }
