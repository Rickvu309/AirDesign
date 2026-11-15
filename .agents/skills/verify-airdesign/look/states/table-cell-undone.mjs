import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  const { page } = kit
  await fixtureDeck(kit)
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  await page.getByRole("button", { name: "3 rows, 3 columns", exact: true }).click()
  const cell = page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="0.0"]')
  await expect(cell).toBeFocused()
  await page.keyboard.type("Region", { delay: 50 })
  await expect(page.getByRole("button", { name: "Undo text edit", exact: true })).toBeEnabled()
  await page.keyboard.press("ControlOrMeta+z")
  await expect(page.getByRole("button", { name: "Redo text edit", exact: true })).toBeEnabled()
  await expect(cell).toBeFocused()
}

export default { name: "table-cell-undone", design: editor, drive }
