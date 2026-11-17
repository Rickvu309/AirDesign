import { expect } from "@playwright/test"

export default {
  name: "sign-up-name",
  design: "/screens/s01-01-sign-up-name",
  async drive(kit) {
    const email = `name${Date.now().toString(36)}@example.com`
    await kit.useSite()
    await kit.page.goto(`${kit.siteOrigin}/sign-in`)
    await kit.page.getByLabel("Email").fill(email)
    await kit.page.getByRole("button", { name: "Continue with email" }).click()
    await expect(kit.page).toHaveURL(`${kit.siteOrigin}/sign-in/check`)
    await expect(kit.page.locator("[data-code-box][data-active]")).toHaveCount(1)
    const { code } = await kit.mailParts(email)
    await kit.page.getByLabel("Or enter the 6-digit code").fill(code)
    await expect(kit.page).toHaveURL(`${kit.origin}/`)
    await expect(kit.page.getByRole("heading", { level: 1 })).toBeVisible()
  },
}
