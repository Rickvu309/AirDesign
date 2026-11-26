import { expect } from "@playwright/test"
import { packageBuild } from "../../../../../scripts/package-build.mjs"

async function drive(kit) {
  await kit.signIn()
  const { creditsRoutes } = await packageBuild(kit.repo, "@airdesign/catalog")
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.usage.path,
    () => new Promise(() => {}),
  )
  await kit.page.route(
    (url) => url.pathname === creditsRoutes.read.path,
    () => new Promise(() => {}),
  )
  await kit.page.goto("/settings/usage")
  await expect(kit.page.getByRole("meter", { name: "Weekly usage" })).toBeVisible()
}

export default { name: "usage-loading", design: null, drive }
