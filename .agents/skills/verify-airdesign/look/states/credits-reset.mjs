import { creditsCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"
import { packageBuild } from "../../../../../scripts/package-build.mjs"

async function drive(kit) {
  await kit.signIn()
  const { creditsRoutes } = await packageBuild(kit.repo, "@airdesign/catalog")
  await kit.page.route(
    (url) => url.pathname === creditsRoutes.read.path,
    (route) =>
      route.fulfill({
        json: { ok: true, credits: { cents: 1500, autoReset: false, history: [] } },
      }),
  )
  await kit.page.route(
    (url) => url.pathname === kit.airaRoutes.usage.path,
    (route) =>
      route.fulfill({
        json: {
          ok: true,
          account: { email: "person@example.com" },
          usage: { used: 1.24, allowed: 2, resets: "2026-11-23T00:00:00.000Z" },
        },
      }),
  )
  await kit.page.goto("/settings/usage")
  await kit.page.getByRole("button", { name: creditsCopy.reset, exact: true }).click()
  await expect(kit.page.getByRole("dialog", { name: creditsCopy.confirmTitle })).toBeVisible()
}

export default { name: "credits-reset", design: "/screens/s92-02-credits-out-of-usage-confirm-reset", drive }
