import { expect } from "@playwright/test"

export default {
  name: "present-controls",
  design: "/screens/s51-02-present-controls",
  async drive({ page }) {
    await page.goto("/screens/s51-02-present-controls")
    await expect(page.locator("[data-show-controls]")).toBeAttached()
  },
}
