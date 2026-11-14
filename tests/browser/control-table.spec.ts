import { expect, test } from "@playwright/test"
import { openDeck, settled } from "./design-panel"

test.use({ viewport: { width: 1600, height: 1000 } })

test("a table control writes one cell, the slide shows it, and Undo empties the cell again", async ({ page }) => {
  await openDeck(page, "table-added.pptx")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await table.locator('[data-table-text="0.0"]').click()
  await page.keyboard.press("Escape")
  const panel = page.locator("[data-design-element]")
  const cells = panel.getByRole("group", { name: "Cells" })
  await expect(cells.getByRole("textbox")).toHaveCount(9)
  await expect(cells.getByRole("textbox", { name: "Row 1, column 1" })).toHaveValue("Region")
  const cell = cells.getByRole("textbox", { name: "Row 2, column 1" })
  await cell.fill("North")
  await cell.press("Enter")
  await expect(table.locator('[data-table-text="1.0"]')).toHaveText("North")
  await expect(cell).toHaveValue("North")
  await page.getByRole("button", { name: "Undo text edit", exact: true }).click()
  await expect(table.locator('[data-table-text="1.0"]')).toHaveText("")
  await expect(cell).toHaveValue("")
  await page.getByRole("button", { name: "Redo text edit", exact: true }).click()
  await expect(table.locator('[data-table-text="1.0"]')).toHaveText("North")
  await page.reload()
  await settled(page)
  await expect(page.locator('[data-slide-paint] [data-canvas-table] [data-table-text="1.0"]')).toHaveText("North")
})
