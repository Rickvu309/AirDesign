import type { Page } from "@playwright/test"
import { exportCopy } from "../../apps/web/src/copy/export-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"

export const dialog = (page: Page) => page.getByRole("dialog", { name: exportCopy.title })
export const exportButton = (page: Page) => page.getByRole("button", { name: productCopy.exportDeck, exact: true })

export async function recordPrints(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const titles: string[] = []
    Object.assign(window, { printTitles: titles })
    window.print = () => {
      titles.push(document.title)
    }
  })
}

export const printTitles = (page: Page) =>
  page.evaluate(() => (window as unknown as { printTitles: readonly string[] }).printTitles)
