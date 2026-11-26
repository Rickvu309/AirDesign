import { expect } from "@playwright/test"
import { creditsCopy } from "../../apps/web/src/copy/credits-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

test("credits start empty and auto reset persists through a reload", async ({ page, context, stack }) => {
  const { creditsRoutes } = await import("../../packages/catalog/src/index.ts")
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  await page.goto("/settings/usage")
  await expect(page.getByText("$0.00", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: creditsCopy.reset, exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: creditsCopy.reset, exact: true })).toHaveCSS("opacity", "0.5")
  await expect(page.getByText(creditsCopy.purchases)).toHaveCount(0)
  const add = page.getByRole("button", { name: creditsCopy.add })
  await expect(add).toBeEnabled()
  await expect(add).toHaveCSS("background-image", /linear-gradient/)
  await add.click()
  await expect(page.locator("[data-sonner-toast]")).toContainText(creditsCopy.purchases)
  await expect(page.getByText(creditsCopy.emptyHistory)).toBeVisible()
  const toggle = page.getByRole("switch", { name: creditsCopy.autoReset, exact: true })
  await toggle.click()
  await expect(toggle).toBeChecked()
  expect((await stack.post(creditsRoutes.read.path, {}, cookie)).json).toMatchObject({ credits: { autoReset: true } })
  await page.reload()
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
})

test("a paid reset confirms its cost and keeps its request id after a lost answer", async ({ page }) => {
  const { creditsRoutes } = await import("../../packages/catalog/src/index.ts")
  let spent = 2
  let cents = 1500
  let charged = false
  const requests: unknown[] = []
  await page.route("**/aira/usage", (route) =>
    route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        usage: { used: spent, allowed: 2, resets: "2026-11-23T00:00:00.000Z" },
      },
    }),
  )
  const credits = () => ({
    cents,
    autoReset: false,
    history: charged ? [{ id: "reset-1", at: "2026-11-17T12:00:00.000Z", cents: -500, kind: "reset" }] : [],
  })
  await page.route(`**${creditsRoutes.read.path}`, (route) => route.fulfill({ json: { ok: true, credits: credits() } }))
  await page.route(`**${creditsRoutes.reset.path}`, async (route) => {
    requests.push(route.request().postDataJSON())
    if (!charged) {
      charged = true
      spent = 0
      cents -= 500
      await route.abort()
    } else await route.fulfill({ json: { ok: true, credits: credits() } })
  })
  await page.goto("/settings/usage")
  await page.getByRole("button", { name: creditsCopy.reset, exact: true }).click()
  const dialog = page.getByRole("dialog", { name: creditsCopy.confirmTitle })
  await expect(dialog).toContainText(creditsCopy.confirmBody)
  await dialog.getByRole("button", { name: creditsCopy.confirm, exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText(creditsCopy.changeFailed)
  await dialog.getByRole("button", { name: creditsCopy.confirm, exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[0]).toEqual(requests[1])
  await expect(page.getByText("$10.00", { exact: true })).toBeVisible()
  await expect(page.getByText("-$5.00", { exact: true })).toBeVisible()
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "0")
})
