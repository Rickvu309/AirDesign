import { expect } from "@playwright/test"

async function drive({ page }) {
  await page.goto("/screens/sample-04-bar-charts")
  await expect(page.locator("[data-doom-slide] [data-line]").first()).toBeVisible()
  await expect(page.locator("[data-fonts-pending]")).toHaveCount(0)
}

export default { name: "sample-04-bar-charts", design: null, drive }
