import { expect, test, type Page } from "@playwright/test"
import { settingsCopy } from "../../apps/web/src/copy/settings-copy"
import { accountCopy } from "../../apps/web/src/copy/account-copy"
import { productCopy } from "../../apps/web/src/copy/product-copy"
import { usageCopy } from "../../apps/web/src/copy/usage-copy"

test.use({ reducedMotion: "reduce" })

async function mockApp(page: Page, email = "person@example.com") {
  await page.route("**/account/profile", (route) => route.fulfill({ json: { ok: true, account: { email, name: "" } } }))
  await page.route("**/decks/list", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, decks: [], trash: [] },
    }),
  )
  await page.route("**/aira/usage", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, usage: { used: 0, allowed: 2, resets: "2026-11-16T00:00:00.000Z" } },
    }),
  )
  await page.route("**/account/agents", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, mcp: "https://mcp.airdesign.test/mcp", agents: [] },
    }),
  )
}

test("reaches Account from the account menu and Settings tabs, sees email, and walks delete confirmation", async ({
  page,
}) => {
  const email = "person@example.com"
  await mockApp(page, email)

  await page.goto("/")
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: settingsCopy.account, exact: true }).click()

  await expect(page).toHaveURL(/\/settings\/account$/)
  await expect(page.getByRole("heading", { name: settingsCopy.title, exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: settingsCopy.account, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  )
  const accountCard = page.locator("[data-settings-content]")
  await expect(page.getByRole("heading", { name: settingsCopy.account, exact: true })).toBeVisible()
  await expect(accountCard.getByText(settingsCopy.signedIn, { exact: true })).toBeVisible()
  await expect(accountCard.getByText(email, { exact: true })).toBeVisible()
  await expect(accountCard.getByRole("button", { name: settingsCopy.signOut, exact: true })).toBeVisible()

  await page.getByRole("link", { name: settingsCopy.usage, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
  await page.getByRole("link", { name: settingsCopy.account, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/account$/)

  await page.getByRole("link", { name: settingsCopy.agents, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/agents$/)
  await page.getByRole("link", { name: settingsCopy.account, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/account$/)

  await accountCard.getByRole("button", { name: settingsCopy.deleteAccount, exact: true }).click()

  const dialog = page.getByRole("dialog", { name: accountCopy.deleteTitle })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(accountCopy.deleteBody)).toBeVisible()
  const confirm = dialog.getByRole("button", { name: settingsCopy.deleteAccount, exact: true })
  await expect(confirm).toBeDisabled()

  await dialog.getByLabel(accountCopy.deleteConfirmLabel).fill(email)
  await expect(confirm).toBeEnabled()

  await dialog.getByRole("button", { name: productCopy.cancel, exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/settings\/account$/)
})

test("follows the sidebar card to the Agents page", async ({ page }) => {
  await mockApp(page)

  await page.goto("/")
  const sidebar = page.locator("[data-decks-sidebar]")
  await expect(sidebar.getByRole("heading", { name: "Bring your own agent" })).toBeVisible()
  await sidebar.getByRole("link", { name: "Connect an agent" }).click()

  await expect(page).toHaveURL(/\/settings\/agents$/)
  await expect(page.getByRole("heading", { name: settingsCopy.agents, exact: true })).toBeVisible()
  await expect(sidebar.getByText(accountCopy.agentCardBody)).toHaveCount(0)
})

test("the account menu's delete dialog stays disabled while the email is unknown, and says what failed when the server refuses", async ({
  page,
}) => {
  const email = "person@example.com"
  await mockApp(page, email)
  await page.route("**/aira/usage", (route) => route.fulfill({ status: 500, json: { ok: false } }))
  let answer = 400
  const posted: unknown[] = []
  await page.route("**/account/delete", (route) => {
    posted.push(route.request().postDataJSON())
    return route.fulfill({ status: answer, json: { ok: false, refusal: "field" } })
  })

  await page.goto("/settings/usage")
  await expect(page.getByRole("alert").filter({ hasText: usageCopy.failed })).toBeVisible()
  await page.locator("[data-decks-sidebar]").getByRole("button").first().click()
  await page.getByRole("menuitem", { name: settingsCopy.deleteAccount, exact: true }).click()
  const dialog = page.getByRole("dialog", { name: accountCopy.deleteTitle })
  const confirm = dialog.getByRole("button", { name: settingsCopy.deleteAccount, exact: true })
  await expect(dialog).toBeVisible()
  await expect(confirm).toBeDisabled()
  await dialog.getByRole("button", { name: productCopy.cancel, exact: true }).click()
  await expect(dialog).toBeHidden()

  await page.goto("/settings/account")
  await page.locator("[data-settings-content]").getByRole("button", { name: settingsCopy.deleteAccount }).click()
  await dialog.getByLabel(accountCopy.deleteConfirmLabel).fill(email)
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(dialog.getByRole("alert")).toHaveText(accountCopy.deleteFailed)
  await expect(dialog).toBeVisible()
  await expect(confirm).toBeEnabled()
  answer = 500
  await confirm.click()
  await expect(dialog.getByRole("alert")).toHaveText(accountCopy.deleteFailed)
  expect(posted).toEqual([{ email }, { email }])
})
