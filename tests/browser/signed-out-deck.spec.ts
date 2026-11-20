import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { forward, signInBrowser, test as stackTest } from "./api-stack"
import { test } from "./deck-test"

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
    route.fulfill({ status: 404, json: { ok: false, refusal: "owner" } }),
  )
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/deck/someone-elses")
  await expect(page.getByText(productCopy.deckNotFoundTitle)).toBeVisible()
  await expect(page.getByRole("link", { name: productCopy.goToDecks })).toHaveAttribute("href", "/")
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0)
  expect(new URL(page.url()).pathname).toBe("/deck/someone-elses")
})

stackTest(
  "a deck on the device is not painted after signing out in Settings",
  async ({ page, context, stack, decks }) => {
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
    const deck = await decks.open()
    await page.goto("/settings/account")
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/sign-in\?next=/)
    await page.route("**/decks/open", () => undefined)
    const held = page.waitForRequest("**/decks/open")
    await page.goto(`/deck/${deck}`)
    await held
    await expect(page.locator(".thin-page")).toBeVisible()
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  },
)
