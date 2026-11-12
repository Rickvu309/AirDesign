import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) => route.abort("failed"),
  )
  await kit.page.goto("/")
  await expect(kit.page.getByRole("alert")).toBeVisible()
}

export default { name: "decks-failed", design: null, drive }
