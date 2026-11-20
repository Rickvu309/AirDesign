import { expect } from "@playwright/test"
import { productCopy, usageResetsOn } from "../../apps/web/src/copy/product-copy.ts"
import { usageCopy, usageUsedOf } from "../../apps/web/src/copy/usage-copy.ts"
import { settingsCopy } from "../../apps/web/src/settings/settings-sample.ts"
import { forward, signInBrowser, test } from "./api-stack"

test.use({ viewport: { width: 1600, height: 1000 }, locale: "en-US", timezoneId: "Asia/Ho_Chi_Minh" })

const resets = usageResetsOn("Mon 7:00 AM")
const spentColor = "rgb(217, 63, 63)"

test("the usage ring shows before any ask, stays current, and See all opens the Usage page", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  const paths = await forward(page, stack)
  await decks.open()
  const side = page.locator("[data-editor-panel]")
  const ring = side.getByRole("button", { name: productCopy.usageTitle })
  await expect(ring).toBeVisible()
  await ring.click()
  const pop = page.getByRole("dialog", { name: productCopy.usageTitle })
  await expect(pop).toContainText("0%")
  await expect(pop).toContainText(usageResetsOn("Mon 7:00 AM"))
  await ring.click()
  await stack.exhaust(cookie)
  await ring.click()
  await expect(pop).toContainText("100%")
  await expect(pop.locator("[data-usage-fill]")).toHaveCSS("background-color", spentColor)
  expect(paths).not.toContain("/aira/turn")
  await pop.getByRole("link", { name: usageCopy.seeAllName }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
  await expect(page.getByRole("heading", { name: settingsCopy.title, exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: settingsCopy.usage, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(page.getByRole("heading", { name: productCopy.usageTitle, exact: true })).toBeVisible()
  await expect(page.getByText(resets, { exact: true })).toBeVisible()
  await expect(page.getByText(usageUsedOf(100), { exact: true })).toBeVisible()
  await expect(page.getByRole("meter", { name: productCopy.usageTitle })).toHaveAttribute("aria-valuenow", "100")
  await expect(page.locator("[data-usage-fill]")).toHaveCSS("background-color", spentColor)
  await expect(page.getByRole("heading", { name: settingsCopy.credits, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: settingsCopy.addCredits, exact: true })).toBeEnabled()
  await expect(page.getByRole("switch", { name: settingsCopy.autoReset })).not.toBeChecked()
  await expect(page.getByRole("heading", { name: settingsCopy.history, exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: settingsCopy.reset, exact: true })).toBeDisabled()
})

test("the account menu opens Usage, and its tabs move between Usage and Agents", async ({ page }) => {
  const email = "person@example.com"
  await page.route("**/decks/list", (route) =>
    route.fulfill({ json: { ok: true, account: { email }, decks: [], trash: [] } }),
  )
  await page.route("**/aira/usage", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, usage: { used: 0.76, allowed: 2, resets: "2026-11-16T00:00:00.000Z" } },
    }),
  )
  await page.route("**/account/agents", (route) =>
    route.fulfill({ json: { ok: true, account: { email }, mcp: "https://mcp.airdesign.test/mcp", agents: [] } }),
  )
  await page.goto("/")
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: settingsCopy.usage }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
  await expect(page.getByText(usageUsedOf(38), { exact: true })).toBeVisible()
  await expect(page.getByText(resets, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: email })).toBeVisible()
  await page.getByRole("link", { name: settingsCopy.agents, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/agents$/)
  await expect(page.getByRole("heading", { name: settingsCopy.mcp, exact: true })).toBeVisible()
  await page.getByRole("link", { name: settingsCopy.usage, exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
})

test("the Usage page says when it cannot load and tries again, and sends a signed-out person to sign in", async ({
  page,
}) => {
  let fail = true
  await page.route("**/aira/usage", (route) =>
    fail
      ? route.fulfill({ status: 500, json: { ok: false, refusal: "server" } })
      : route.fulfill({
          json: {
            ok: true,
            account: { email: "person@example.com" },
            usage: { used: 0, allowed: 2, resets: "2026-11-16T00:00:00.000Z" },
          },
        }),
  )
  await page.goto("/settings/usage")
  const usageAlert = page.getByRole("alert").filter({ hasText: usageCopy.failed })
  await expect(usageAlert).toBeVisible()
  fail = false
  await usageAlert.getByRole("button", { name: productCopy.payTryAgain, exact: true }).click()
  await expect(page.getByText(usageUsedOf(0), { exact: true })).toBeVisible()
  await page.unroute("**/aira/usage")
  await page.route("**/aira/usage", (route) => route.fulfill({ status: 401, json: { ok: false, refusal: "session" } }))
  await page.route("**/sign-in?*", (route) => route.fulfill({ body: "Sign in" }))
  await page.goto("/settings/usage?from=menu")
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings%2Fusage%3Ffrom%3Dmenu$/)
})

test("a long email stays inside the sidebar with its menu arrow, and the full address is its title", async ({
  page,
}) => {
  const email = "first.name.of.a.person@a-long-company-name.example.com"
  await page.route("**/decks/list", (route) =>
    route.fulfill({ json: { ok: true, account: { email }, decks: [], trash: [] } }),
  )
  await page.route("**/aira/usage", (route) =>
    route.fulfill({
      json: { ok: true, account: { email }, usage: { used: 0, allowed: 2, resets: "2026-11-16T00:00:00.000Z" } },
    }),
  )
  await page.goto("/settings/usage")
  const sidebar = await page.locator("[data-decks-sidebar]").boundingBox()
  const name = page.locator("[data-account-name]")
  await expect(name).toHaveAttribute("title", email)
  const arrow = await page.getByRole("button", { name: email }).locator("svg").last().boundingBox()
  expect(sidebar).not.toBeNull()
  expect(arrow).not.toBeNull()
  expect(arrow!.x + arrow!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width)
})

test("the Usage page shows a loading label while usage is loading and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  let resolveRoute: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    resolveRoute = resolve
  })
  await page.route("**/aira/usage", async (route) => {
    await gate
    await route.fulfill({
      json: {
        ok: true,
        account: { email: "person@example.com" },
        usage: { used: 0.76, allowed: 2, resets: "2026-11-16T00:00:00.000Z" },
      },
    })
  })
  await page.goto("/settings/usage")
  const meter = page.getByRole("meter", { name: productCopy.usageTitle })
  await expect(meter).toBeVisible()
  await expect(meter).toHaveAttribute("aria-valuenow", "0")
  const label = page.getByText(usageCopy.loading)
  await expect(label).toBeVisible()
  await expect(label).toHaveCSS("animation-name", "none")
  resolveRoute?.()
  await expect(page.getByText(usageUsedOf(38), { exact: true })).toBeVisible()
  await expect(page.getByText(usageCopy.loading)).toHaveCount(0)
})
