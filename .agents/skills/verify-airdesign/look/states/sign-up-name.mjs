import { accountCopy } from "../../bin/product-copy.mjs"

export default {
  name: "sign-up-name",
  design: "/screens/s01-01-sign-up-name",
  async drive(kit) {
    const email = `name${Date.now().toString(36)}@example.com`
    await kit.useSite()
    await kit.page.goto(`${kit.siteOrigin}/sign-in`)
    await kit.page.getByLabel("Email").fill(email)
    await kit.page.getByRole("button", { name: "Continue with email" }).click()
    await kit.page.locator("[data-code-box][data-active]").waitFor()
    const { code } = await kit.mailParts(email)
    await kit.page.getByLabel("Or enter the 6-digit code").fill(code)
    await kit.page.getByRole("heading", { name: accountCopy.nameTitle, exact: true }).waitFor()
  },
}
