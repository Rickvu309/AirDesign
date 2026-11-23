import { productCopy } from "../../apps/web/src/copy/product-copy"
import type { Page } from "@playwright/test"

export async function newDoomDeck(page: Page): Promise<void> {
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
}
