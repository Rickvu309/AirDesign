import { expect, test } from "@playwright/test";

test("recents grid shows recent decks", async ({ page }) => {
  await page.goto("/screens/s31-02-decks-browse-recents-grid");
  await expect(page.getByRole("heading", { name: "Recents", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Project Atlas", level: 2 })).toBeVisible();
});
