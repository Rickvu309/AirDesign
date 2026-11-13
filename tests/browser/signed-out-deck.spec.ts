import { expect, test } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { forward, openClean, signInBrowser, test as stackTest } from "./api-stack"

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

stackTest("a deck on the device is not painted after signing out in Settings", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.route(
    (url) => url.pathname.startsWith("/account/") || url.pathname === "/sign-out",
    async (route) => {
      const request = route.request()
      const answer = await route.fetch({
        url: `${stack.origin}${new URL(request.url()).pathname}`,
        headers: await request.allHeaders(),
      })
      await route.fulfill({ response: answer })
    },
  )
  const deck = await openClean(page)
  await page.goto("/settings/account")
  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await page.route("**/decks/open", () => undefined)
  await page.goto(`/deck/${deck}`)
  await expect(page.locator(".thin-page")).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.locator(".thin-page")).not.toHaveAttribute("data-deck-ready", /.+/)
})
