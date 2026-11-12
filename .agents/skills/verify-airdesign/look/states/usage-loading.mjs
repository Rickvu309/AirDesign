import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route("**/aira/usage", () => new Promise(() => {}))
  await kit.page.goto("/settings/usage")
  await expect(kit.page.getByRole("meter", { name: "Weekly usage" })).toBeVisible()
}

export default { name: "usage-loading", design: null, drive }
