import { expect, test } from "@playwright/test"

test("home lists server decks instead of sample decks", async ({ page }) => {
  await page.route("**/decks/list", (route) => route.fulfill({ json: {
    ok: true,
    account: { email: "home@example.com" },
    decks: [{ deck: "first", name: "Real presentation", edited: "2026-11-11T12:00:00Z", created: "2026-10-30T12:00:00Z" }],
    trash: [],
  } }))
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Real presentation" })).toBeVisible()
  await expect(page.getByText("home@example.com")).toBeVisible()
  await expect(page.getByText("Starred", { exact: true })).toHaveCount(0)
})
