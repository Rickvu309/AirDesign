import { expect } from "@playwright/test"
import { openDeck } from "./design-panel"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { test } from "./deck-test"
import { covers } from "./gesture"

test("Insert table picks rows and columns by drag or Shift+T, and Tab types across the new table", async ({
  page,
  decks,
}) => {
  covers("tool-table")
  await openDeck(page, "blank.pptx")
  await page.locator("[data-slide-paint]").click({ position: { x: 4, y: 4 } })
  await page.keyboard.press("Shift+T")
  const picker = page.locator("[data-table-picker]")
  await expect(picker).toBeVisible()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowRight")
  await expect(picker).toContainText(tableCopy.sizeOf(2, 2))
  await page.keyboard.press("Escape")
  await expect(picker).toHaveCount(0)
  await page.getByRole("button", { name: tableCopy.tool, exact: true }).click()
  await page.getByRole("button", { name: tableCopy.sizeOf(1, 1), exact: true }).hover()
  await page.mouse.down()
  await page.getByRole("button", { name: tableCopy.sizeOf(2, 3), exact: true }).hover()
  await expect(picker).toContainText(tableCopy.sizeOf(2, 3))
  await page.mouse.up()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toHaveAttribute("aria-rowcount", "2")
  await expect(table).toHaveAttribute("aria-colcount", "3")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  for (const word of ["Region", "Revenue", "Growth", "Europe"]) {
    await page.keyboard.type(word)
    await page.keyboard.press("Tab")
  }
  await expect(table.locator('[data-table-text="1.1"]')).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  await page.reload()
  await decks.ready()
  await expect(table).toContainText("Revenue")
  await expect(table.locator('[data-table-cell="1.0"]')).toContainText("Europe")
})
