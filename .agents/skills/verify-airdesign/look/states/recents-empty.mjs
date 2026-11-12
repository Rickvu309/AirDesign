import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  const when = new Date().toISOString()
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          account: { email: "person@example.com" },
          decks: [],
          trash: [{ deck: "trashed-1", name: "Old deck", edited: when, created: when, trashed: when }],
        }),
      }),
  )
  await kit.page.goto("/")
  await expect(kit.page.getByRole("link", { name: "Trash" })).toBeVisible()
}

export default { name: "recents-empty", design: null, drive }
