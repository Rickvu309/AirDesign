import { productCopy } from "../../../../../apps/web/src/copy/product-copy.ts"
import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
    .click()
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.getByRole("button", { name: "Insert table", exact: true }).click()
  await page.getByRole("button", { name: "3 rows, 3 columns", exact: true }).click()
  const table = page.locator("[data-slide-paint] [data-canvas-table]")
  await expect(table.locator('[data-table-text="0.0"]')).toBeFocused()
  await page.keyboard.type("Region")
  await page.keyboard.press("Tab")
  await page.keyboard.type("Sales")
  await expect(page.getByRole("toolbar", { name: "Table rows" })).toBeVisible()
}

export default { name: "table-bar", design: editor, drive }
