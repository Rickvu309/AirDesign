import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import type { Page } from "@playwright/test"

const blankStart = join(process.cwd(), "packages/templates/files/neutral-start.pptx")

export async function newBlankDeck(page: Page): Promise<void> {
  await page.locator("input[type=file]").setInputFiles({
    name: `${productCopy.blankDeck}.pptx`,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await readFile(blankStart),
  })
}

export async function newDoomDeck(page: Page): Promise<void> {
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await page
    .getByRole("menu", { name: productCopy.newDeck })
    .getByRole("menuitem", { name: productCopy.blankDeck, exact: true })
    .click()
}

export async function importTitleDeck(page: Page): Promise<void> {
  await page.locator("input[type=file]").setInputFiles("scripts/pptx-fixtures/blank.pptx")
}
