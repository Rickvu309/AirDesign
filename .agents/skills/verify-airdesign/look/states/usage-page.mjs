import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/settings/usage")
  await expect(kit.page.getByText(/% used$/)).toBeVisible()
}

export default { name: "usage-page", design: "/screens/s81-01-settings-settings-usage-tab", drive }
