import { expect } from "@playwright/test"
import consent from "./consent-claude.mjs"

async function drive(kit) {
  await consent.drive(kit)
  await kit.page.route(`**${kit.oauthRoutes.approve.path}`, (route) => route.abort("failed"))
  await kit.page.getByRole("button", { name: "Allow", exact: true }).click()
  await expect(kit.page.getByRole("link", { name: "Reload consent" })).toBeVisible()
}

export default { name: "consent-unavailable", design: "/screens/s71-04-agents-connect-unavailable", drive }
