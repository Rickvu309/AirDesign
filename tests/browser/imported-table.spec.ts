import { expect } from "@playwright/test"
import { openDeck } from "./design-panel"
import { tableCopy } from "../../apps/web/src/copy/table-copy"
import { test } from "./deck-test"

test("an imported table takes typing in the cell a double-click lands on and keeps it after reload", async ({
  page,
  decks,
}) => {
  await openDeck(page, "table-added.pptx")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await table.click()
  await expect(page.locator("[data-design-element]")).toBeVisible()
  await expect(page.locator("[data-design-element]").getByRole("group", { name: tableCopy.cells })).toHaveCount(0)
  await table.locator('[data-table-cell="1.0"]').dblclick()
  const cell = table.locator('[data-table-text="1.0"]')
  await expect(cell).toBeFocused()
  await page.keyboard.type("Europe")
  await page.keyboard.press("Escape")
  await expect(table).toBeFocused()
  await page.reload()
  await decks.ready()
  await expect(table.locator('[data-table-cell="1.0"]')).toContainText("Europe")
})
