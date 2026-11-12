import { expect, test } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"

test("a deck address opened signed out and with nothing on the device goes to sign-in and keeps the path", async ({
  page,
}) => {
  await page.route("**/decks/original", (route) =>
    route.fulfill({ status: 401, json: { ok: false, refusal: "session" } }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/deck/lost-deck?slide=2")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdeck%2Flost-deck%3Fslide%3D2$/)
})

test("a deck address a signed-in person may not open keeps the refusal and stays on the address", async ({ page }) => {
  await page.route("**/decks/original", (route) =>
    route.fulfill({ status: 404, json: { ok: false, refusal: "missing" } }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/deck/someone-elses")
  await expect(page.getByText(productCopy.deckOpenFailed)).toBeVisible()
  expect(new URL(page.url()).pathname).toBe("/deck/someone-elses")
})
