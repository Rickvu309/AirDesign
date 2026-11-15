import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { forward, openClean, signInBrowser, test } from "./api-stack"

test.use({ reducedMotion: "reduce" })

test("an address nothing serves shows Page not found with a link to the decks", async ({ page, context, stack }) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.goto("/thin")
  await expect(page.getByRole("heading", { name: productCopy.addressNotFoundTitle })).toBeVisible()
  await page.goto("/no-such-page")
  await expect(page.getByRole("heading", { name: productCopy.addressNotFoundTitle })).toBeVisible()
  await expect(page.getByText(productCopy.addressNotFoundBody)).toBeVisible()
  await expect(page.locator("[data-decks-sidebar]")).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0)
  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole("heading", { name: "Recents" })).toBeVisible()
})

test("a deck that is not in the account shows Deck not found with a link to the decks", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  await forward(page, stack)
  await page.goto("/deck/someone-elses-deck")
  await expect(page.getByRole("heading", { name: productCopy.deckNotFoundTitle })).toBeVisible()
  await expect(page.getByText(productCopy.deckNotFoundBody)).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "New slide" })).toHaveCount(0)
  await expect(page.getByText(productCopy.deckOpenFailed)).toHaveCount(0)
  await page.getByRole("link", { name: productCopy.goToDecks }).click()
  await expect(page).toHaveURL(/\/$/)
})

test("a deck deleted for good shows Deck not found and stays closed after a reload", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  expect((await stack.post("/decks/trash", { deck }, cookie)).json.ok).toBe(true)
  expect((await stack.post("/decks/delete", { decks: [deck] }, cookie)).json.ok).toBe(true)
  await expect(page.getByRole("heading", { name: productCopy.deckNotFoundTitle })).toBeVisible()
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("heading", { name: productCopy.deckNotFoundTitle })).toBeVisible()
  await expect(page.getByRole("link", { name: productCopy.goToDecks })).toHaveAttribute("href", "/")
})
