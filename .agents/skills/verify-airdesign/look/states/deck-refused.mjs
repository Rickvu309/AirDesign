import { expect } from "@playwright/test"
import { fixtureDeck } from "../fixture-deck.mjs"

async function drive(kit) {
  await fixtureDeck(kit)
  const address = kit.page.url()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.open.path || url.pathname === kit.deckRoutes.watch.path,
    (route) => route.fulfill({ json: { ok: false, refusal: "deleted" } }),
  )
  await kit.page.goto(address)
  await expect(kit.page.locator("[data-deck-refused]")).toBeVisible()
}

export default { name: "deck-refused", design: null, drive }
