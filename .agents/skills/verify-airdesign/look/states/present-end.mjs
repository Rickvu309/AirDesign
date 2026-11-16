import { expect } from "@playwright/test"

export default {
  name: "present-end",
  design: "/screens/s51-04-present-end-of-deck",
  async drive({ page }) {
    await page.goto("/screens/s51-04-present-end-of-deck")
    await expect(page.locator("[data-present-end]")).toBeAttached()
  },
}
