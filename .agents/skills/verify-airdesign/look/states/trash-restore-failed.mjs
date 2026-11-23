import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  const when = new Date().toISOString()
  const deck = {
    deck: "deck-restore",
    name: "Pricing Strategy Review",
    edited: when,
    created: when,
    trashed: when,
    doom: { rev: 1 },
  }
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) =>
      route.fulfill({ json: { ok: true, account: { email: "person@example.com" }, decks: [], trash: [deck] } }),
  )
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.restore.path,
    (route) => route.fulfill({ json: { ok: false, refusal: "missing" } }),
  )
  await kit.page.goto("/trash")
  await kit.page.getByRole("button", { name: "Restore", exact: true }).click()
  await kit.page
    .getByText("Unable to restore Pricing Strategy Review", { exact: true })
    .waitFor({ timeout: 3000 })
    .catch(() => undefined)
  await expect(kit.page.getByRole("heading", { name: deck.name })).toBeVisible()
}

export default { name: "trash-restore-failed", design: "/screens/s33-02-decks-trash-list", drive }
