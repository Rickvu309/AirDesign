import { createRequire } from "node:module"
import { expect } from "@playwright/test"

const { settingsCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/settings-copy.ts")

export default async function drive({ page, signIn, post, capture, note, airaRoutes }) {
  const { cookie, email } = await signIn()
  await page.goto("/")
  await page.getByRole("button", { name: email }).click()
  await page.getByRole("menuitem", { name: "Usage" }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
  const tabs = page.getByRole("navigation", { name: "Settings" })
  await expect(tabs.getByRole("link", { name: "Usage" })).toHaveAttribute("aria-current", "page")
  const meter = page.getByRole("meter", { name: "Weekly usage" })
  await expect(meter).not.toHaveAttribute("aria-busy", "true")
  const week = (await post(airaRoutes.usage, {}, cookie)).json
  note(`the server's usage answer: ${JSON.stringify(week)}`)
  await expect(meter).toHaveAttribute("aria-valuenow", /^\d+$/)
  await expect(page.getByText(/^Resets /)).toBeVisible()
  await expect(page.getByText(/\d+% used/)).toBeVisible()
  await capture("usage-loaded")
  await tabs.getByRole("link", { name: "Agents" }).click()
  await expect(page).toHaveURL(/\/settings\/agents$/)
  await expect(page.getByText(settingsCopy.noAgents, { exact: true })).toBeVisible()
  await page.goto("/")
  await page.getByRole("link", { name: "Settings" }).click()
  await expect(page).toHaveURL(/\/settings\/usage$/)
  await page.route(`**${airaRoutes.usage.path}`, (route) => route.abort("connectionfailed"))
  await page.reload()
  await expect(page.getByRole("alert")).toContainText("Unable to load your usage")
  await capture("usage-failed")
  await page.unroute(`**${airaRoutes.usage.path}`)
  await page.getByRole("alert").getByRole("button", { name: "Try again" }).click()
  await expect(page.getByText(/\d+% used/)).toBeVisible()
  note(
    "the account menu and the sidebar Settings link open /settings/usage with the week's meter; a failed load shows an alert whose Try again loads it",
  )
}
