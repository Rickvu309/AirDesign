import { expect } from "@playwright/test"

export async function openAccount(kit) {
  const { email } = await kit.signIn()
  await kit.page.goto("/settings/account")
  await expect(kit.page.locator("[data-settings-content]").getByText(email, { exact: true })).toBeVisible()
}
