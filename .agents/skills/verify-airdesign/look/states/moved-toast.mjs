import { expect } from "@playwright/test"

export default {
  name: "moved-toast",
  design: "/screens/s33-01-decks-trash-deck-moved-toast",
  async drive({ page }) {
    await page.goto("/screens/s33-01-decks-trash-deck-moved-toast")
    await expect(page.locator("[data-sonner-toast]")).toContainText("Pricing Strategy Review moved to Trash")
  },
}
