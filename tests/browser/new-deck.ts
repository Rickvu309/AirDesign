import { productCopy } from "../../apps/web/src/copy/product-copy"
import type { Page } from "@playwright/test"

export async function newBlankDeck(page: Page): Promise<void> {
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
    .click()
}

export async function importTitleDeck(page: Page): Promise<void> {
  await page.locator("input[type=file]").setInputFiles("scripts/pptx-fixtures/blank.pptx")
}
