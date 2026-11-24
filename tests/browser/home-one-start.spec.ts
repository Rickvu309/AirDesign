import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { forward, signInBrowser, test } from "./api-stack"

test("an empty home starts a deck from New deck alone", async ({ page, context, stack }) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: productCopy.noDecksTitle })).toBeVisible()
  await expect(page.getByRole("button", { name: productCopy.newDeck, exact: true })).toHaveCount(1)
  await expect(page.getByRole("button", { name: productCopy.blankDeck, exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: productCopy.newDeck, exact: true }).click()
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9_-]{1,64}(\?node-id=.*)?$/)
  await page.locator("[data-editor-ready]").waitFor()
})
