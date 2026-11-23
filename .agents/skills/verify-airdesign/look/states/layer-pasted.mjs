import { editor } from "../editor-screen.mjs"
import { expect } from "@playwright/test"
import { twoShapes } from "../doom-canvas.mjs"
import { openDoomDeck, selectNode } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit, twoShapes)
  await selectNode(page, "w:1")
  await page.keyboard.press("ControlOrMeta+KeyC")
  await page.getByRole("button", { name: "Add slide", exact: true }).click()
  const entry = page.locator('[data-slide-entry="2"]')
  await expect(entry).toHaveAttribute("aria-current", "true")
  await page.locator("[data-canvas-stage]").focus()
  await page.keyboard.press("ControlOrMeta+KeyV")
  await expect(page.locator("[data-selection-outline]")).toHaveCount(1)
}

export default { name: "layer-pasted", design: editor, drive }
