import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    () => new Promise(() => {}),
  )
  await kit.page.goto("/?view=list")
  await expect(kit.page.locator("[data-loading]")).toBeVisible()
}

export default { name: "decks-list-loading", design: null, drive }
