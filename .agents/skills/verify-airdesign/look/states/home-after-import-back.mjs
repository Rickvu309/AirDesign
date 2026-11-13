import path from "node:path"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.open.path,
    () => new Promise(() => {}),
  )
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles(path.join(kit.repo, "scripts/pptx-fixtures/clean.pptx"))
  await expect(kit.page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await kit.page.goBack()
  await expect(kit.page).toHaveURL(/\/$/)
  await expect(kit.page.locator("[data-loading]")).toHaveCount(0)
  await kit.page.waitForTimeout(1000)
}

export default { name: "home-after-import-back", design: "/screens/s31-02-decks-browse-recents-grid", drive }
