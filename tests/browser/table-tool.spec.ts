import { expect, test } from "@playwright/test"
import { openDeck } from "./design-panel"
import { tableCopy } from "../../apps/web/src/copy/table-copy"

test("the toolbar no longer offers table creation", async ({ page }) => {
  await openDeck(page, "blank.pptx")
  await expect(page.getByRole("button", { name: tableCopy.tool, exact: true })).toHaveCount(0)
  await expect(page.locator("[data-table-picker]")).toHaveCount(0)
})
