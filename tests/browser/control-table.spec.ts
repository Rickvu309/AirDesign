import { expect, test } from "@playwright/test"
import { openDeck, settled } from "./design-panel"
import { tableCopy } from "../../apps/web/src/copy/table-copy"

test("an imported table paints without insert, cell or table Design controls after reload", async ({ page }) => {
  await openDeck(page, "table-added.pptx")
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table).toContainText("Region")
  await expect(page.getByRole("button", { name: tableCopy.tool, exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Design", exact: true }).click()
  await table.click()
  await expect(page.locator("[data-design-element]")).toBeVisible()
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator("[data-table-bar], [data-table-picker]")).toHaveCount(0)
  await expect(page.locator("[data-design-element]").getByRole("group", { name: tableCopy.cells })).toHaveCount(0)
  await page.reload()
  await settled(page)
  await expect(table).toContainText("Region")
  await expect(table.locator('[contenteditable="true"]')).toHaveCount(0)
})
