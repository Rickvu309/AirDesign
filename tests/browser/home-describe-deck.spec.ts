import { expect } from "@playwright/test"
import { productCopy } from "../../apps/web/src/copy/product-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US" })

const words = "A board update on Q3 revenue, numbers first"

test("describing a deck on the home makes a deck and sends the words to Aira once, and a reload does not send them again", async ({
  page,
  context,
  stack,
}) => {
  await signInBrowser(context, await stack.signIn())
  const called = await forward(page, stack)
  stack.aira({ name: "turn.sse" })
  await page.goto("/")
  const box = page.getByRole("textbox", { name: productCopy.describeDeck })
  await box.fill(words)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/s\/[A-Za-z0-9_-]{1,64}(\?node-id=.*)?$/)
  await page.locator("[data-editor-ready]").waitFor()
  expect(page.url()).not.toContain("Q3")
  const log = page.locator("[data-editor-panel]").getByRole("log")
  await expect(log.getByText(words, { exact: true })).toBeVisible()
  await expect(log.getByText("Lead with the claim. Then show the evidence.", { exact: true })).toBeVisible()
  const sent = () => called.filter((path) => path === "/aira/turn").length
  const first = sent()
  expect(first).toBe(1)

  await page.reload()
  await page.locator("[data-editor-ready]").waitFor()
  await expect(log.getByText(words, { exact: true })).toHaveCount(1)
  expect(sent()).toBe(first)
})
