import { expect } from "@playwright/test"

export default {
  name: "present-slide",
  design: "/screens/s51-01-present-slide",
  async drive({ page }) {
    await page.goto("/screens/s51-01-present-slide")
    await expect(page.locator("[data-present-show]")).toBeAttached()
  },
}
