export default {
  name: "sign-in-sending",
  design: null,
  async drive(kit) {
    await kit.useSite()
    await kit.page.route(`${kit.siteOrigin}${kit.signInRoutes.email.path}`, () => undefined)
    await kit.page.goto(`${kit.siteOrigin}/sign-in`)
    await kit.page.getByLabel("Email").fill("ada@example.com")
    await kit.page.getByRole("button", { name: "Continue with email" }).click()
  },
}
