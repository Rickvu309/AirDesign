import { expect } from "@playwright/test"
import { editorCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { openDoomDeck } from "../doom-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await openDoomDeck(kit)
  const toggle = page.getByRole("button", { name: editorCopy.sidePanel, exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "false")
  await expect(page.locator("[data-editor-panel]")).toBeHidden()
  await page.mouse.move(120, 700)
}

export default { name: "panel-closed", design: editor, drive }
