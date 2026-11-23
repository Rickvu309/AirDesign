import { expect } from "@playwright/test"
import { frameCopy } from "../../bin/product-copy.mjs"
import { autoRow, centre } from "../doom-canvas.mjs"
import { openDesign, openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, autoRow())
  await openDesign(page)
  await selectNode(page, "f:1", { position: { x: 12, y: 12 } })
  const panel = page.locator("[data-design-panel]")
  await panel.getByRole("button", { name: frameCopy.removeAutoLayout }).click()
  const at = await centre(page, "w:2")
  await page.mouse.click(at.x, at.y)
  await page.mouse.dblclick(at.x, at.y)
  await expect(page.locator('[data-selection-outline="w:2"]')).toBeAttached()
  await page.mouse.move(4, 4)
}

export default { name: "frame-child", design: null, drive }
