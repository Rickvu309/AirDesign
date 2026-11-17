import { expect, type Page } from "@playwright/test"
import { zoomToOf } from "../../apps/web/src/copy/product-copy"

export async function actualSize(page: Page): Promise<void> {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: zoomToOf(100), exact: true }).click()
  await expect(page.locator("[data-zoom-readout]")).toHaveText("100%")
}
