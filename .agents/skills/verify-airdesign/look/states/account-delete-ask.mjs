import { expect } from "@playwright/test"
import { openAccount } from "../open-account.mjs"

async function drive(kit) {
  await openAccount(kit)
  await kit.page.locator("[data-settings-content]").getByRole("button", { name: "Delete account", exact: true }).click()
  await expect(kit.page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible()
}

export default { name: "account-delete-ask", design: null, drive }
