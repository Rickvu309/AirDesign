import { expect, type Page } from "@playwright/test"
import { test } from "./deck-test"
import { settingsCopy } from "../../apps/web/src/copy/settings-copy"
import { accountCopy } from "../../apps/web/src/copy/account-copy"
import { connectAgentCopy } from "../../apps/web/src/copy/connect-agent-copy"
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

test("the first-visit button opens Connect an agent over Home, and the Agents tab hides the sidebar promo", async ({
  page,
}) => {
  await mockApp(page)

  await page.goto("/")
  const sidebar = page.locator("[data-decks-sidebar]")
  await expect(page.getByRole("heading", { name: productCopy.noDecksTitle })).toBeVisible()
  await expect(sidebar.getByRole("heading", { name: "Bring your own agent" })).toHaveCount(0)
  const connect = sidebar.getByRole("button", { name: connectAgentCopy.title })
  await expect(connect).toHaveCSS("height", "36px")
  await connect.click()

  const dialog = page.getByRole("dialog", { name: connectAgentCopy.title })
  await expect(dialog.getByText("https://mcp.airdesign.test/mcp", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  await page.goto("/settings/agents")
  await expect(page.getByRole("heading", { name: settingsCopy.noAgents, exact: true })).toBeVisible()
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

test("the name field has one continuous focus edge in normal and invalid states", async ({ page }) => {
  await mockApp(page)
  await page.route("**/account/profile", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "person@example.com", name: "Person" } } }),
  )
  await page.goto("/settings/account")
  const input = page.getByLabel(accountCopy.name, { exact: true })
  await expect(input).toHaveValue("Person")
  await page.keyboard.press("Tab")
  await input.focus()
  for (const invalid of [false, true]) {
    if (invalid) {
      await input.fill("   ")
      await input.press("Enter")
      await expect(page.getByRole("alert")).toHaveText(accountCopy.nameInvalid)
    }
    await expect(input).toBeFocused()
    const edge = await input.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        border: style.borderColor,
        outline: style.outlineColor,
        offset: Number.parseFloat(style.outlineOffset),
        width: Number.parseFloat(style.outlineWidth),
        shadow: style.boxShadow,
      }
    })
    expect(edge.border).toBe(edge.outline)
    expect(edge.offset).toBeLessThanOrEqual(0)
    expect(edge.width).toBeGreaterThan(0)
    expect(edge.shadow).toBe("none")
  }
})

test("Settings keeps its heading and cards 24px inside the pane on a narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await mockApp(page)
  await page.goto("/settings/account")
  const pane = await page.locator("[data-settings-header]").boundingBox()
  const heading = await page.getByRole("heading", { name: settingsCopy.title, exact: true }).boundingBox()
  const cards = await page.locator("[data-settings-content]").evaluate((content) => {
    const style = getComputedStyle(content)
    const box = content.getBoundingClientRect()
    return { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) }
  })
  expect(heading!.x - pane!.x).toBeGreaterThanOrEqual(24)
  expect(cards.left - pane!.x).toBeGreaterThanOrEqual(24)
  expect(pane!.x + pane!.width - cards.right).toBeGreaterThanOrEqual(24)
})

test("the Profile card trims bottom dead space without jumping when the name error appears", async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 923 })
  await mockApp(page)
  await page.route("**/account/profile", (route) =>
    route.fulfill({ json: { ok: true, account: { email: "person@example.com", name: "Person" } } }),
  )
  await page.goto("/settings/account")
  const input = page.getByLabel(accountCopy.name, { exact: true })
  await expect(input).toHaveValue("Person")

  const measure = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>("[data-settings-content] > section")]
      const profile = cards[0]
      const account = cards[1]
      const field = profile?.querySelector<HTMLElement>('input[name="name"]')
      const alert = profile?.querySelector<HTMLElement>('[role="alert"]')
      if (!profile || !account || !field || !alert) throw new Error("missing account cards")
      const profileBox = profile.getBoundingClientRect()
      const accountBox = account.getBoundingClientRect()
      const fieldBox = field.getBoundingClientRect()
      const alertBox = alert.getBoundingClientRect()
      return {
        belowInput: profileBox.bottom - fieldBox.bottom,
        profileHeight: profileBox.height,
        accountTop: accountBox.top,
        alertGap: alertBox.top - fieldBox.bottom,
        alertBottomClearance: profileBox.bottom - alertBox.bottom,
      }
    })

  const before = await measure()
  expect(before.belowInput).toBeLessThanOrEqual(36)

  await input.fill("   ")
  await input.press("Enter")
  await expect(page.getByRole("alert")).toHaveText(accountCopy.nameInvalid)

  const after = await measure()
  expect(Math.abs(after.profileHeight - before.profileHeight)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(after.accountTop - before.accountTop)).toBeLessThanOrEqual(0.5)
  expect(after.alertGap).toBeGreaterThanOrEqual(4)
  expect(after.alertBottomClearance).toBeGreaterThanOrEqual(8)
})
