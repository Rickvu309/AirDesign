export const deckNames = [
  "Project Atlas",
  "Q3 Investor Update",
  "FY26 Operating Plan",
  "Pricing Strategy Review",
  "Board Pack, October",
  "Germany Market Sizing",
  "Hiring Plan",
  "Brand Refresh",
]

export async function listDecks(kit, names = deckNames) {
  await kit.signIn()
  const base = Date.now()
  const decks = names.map((name, index) => {
    const when = new Date(base - index * 86400000).toISOString()
    return { deck: `deck-${index}`, name, edited: when, created: when, doom: { rev: 1 } }
  })
  await kit.page.route(
    (url) => url.pathname === kit.deckRoutes.list.path,
    (route) => route.fulfill({ json: { ok: true, account: { email: "person@example.com" }, decks, trash: [] } }),
  )
}
