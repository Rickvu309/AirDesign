import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    () => new Promise(() => {}),
  )
  await kit.page.goto("/")
  await expect(kit.page.locator("[data-loading]")).toBeVisible()
}

export default { name: "decks-loading", design: null, drive }
