import { expect } from "@playwright/test"

export default {
  name: "present-go-to",
  design: "/screens/s51-03-present-go-to-slide",
  async drive({ page }) {
    await page.goto("/screens/s51-03-present-go-to-slide")
    await expect(page.locator("[data-present-go-to]")).toBeAttached()
  },
}
