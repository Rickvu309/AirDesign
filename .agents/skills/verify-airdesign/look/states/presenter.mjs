import { expect } from "@playwright/test"

export default {
  name: "presenter",
  design: "/screens/s52-01-present-presenter-view",
  async drive({ page }) {
    await page.goto("/screens/s52-01-present-presenter-view")
    await expect(page.locator("[data-presenter-view]")).toBeAttached()
  },
}
