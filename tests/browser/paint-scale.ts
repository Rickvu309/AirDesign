import { expect, type Page } from "@playwright/test"

export async function actualSize(page: Page): Promise<void> {
  await page.locator("[data-zoom-readout]").click()
  await page.getByRole("menuitemradio", { name: "100%", exact: true }).click()
  await expect(page.locator("[data-zoom-readout]")).toHaveText("100%")
}
