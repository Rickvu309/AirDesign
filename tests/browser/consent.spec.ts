import { expect, test } from "@playwright/test"

test("a refused client never shows consent or redirects", async ({ page }) => {
  await page.route("**/oauth/client", async (route) => {
    await route.fulfill({ status: 400, json: { ok: false, refusal: "client" } })
  })

  await page.goto(
    "/oauth/authorize?response_type=code&client_id=unknown&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&code_challenge=challenge&code_challenge_method=S256",
  )

  await expect(page.getByText("This app can't connect to AirDesign.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Allow", exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/oauth\/authorize/)
})
