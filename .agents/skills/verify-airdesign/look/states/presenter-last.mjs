import { expect } from "@playwright/test"

export default {
  name: "presenter-last",
  design: "/screens/s52-02-present-presenter-view-last-slide",
  async drive({ page }) {
    await page.goto("/screens/s52-02-present-presenter-view-last-slide")
    await expect(page.locator("[data-presenter-view]")).toBeAttached()
  },
}
