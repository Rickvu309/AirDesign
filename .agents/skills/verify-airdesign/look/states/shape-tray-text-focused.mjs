import { expect } from "@playwright/test"
import { shapeCopy } from "../../bin/product-copy.mjs"
import { centre } from "../doom-canvas.mjs"
import { openDoomDeck, spot, words } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, [
    { id: "w:1", props: { name: "Words", box: spot(960, 260, 760, 120), text: words("Quarterly review") } },
  ])
  const at = await centre(page, "w:1")
  await page.mouse.dblclick(at.x, at.y)
  await expect(page.locator('[data-slide-box] [contenteditable="true"]')).toBeFocused()
  await page.getByRole("button", { name: shapeCopy.tool, exact: true }).click()
  const line = page.locator("[data-shape-tray]").getByRole("button", { name: shapeCopy.line, exact: true })
  await line.focus()
  await expect(line).toBeFocused()
}

export default { name: "shape-tray-text-focused", design: null, drive }
