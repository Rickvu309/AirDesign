import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DeckCard } from "@/decks/deck-card"
import { DeckMenu } from "@/decks/deck-menu"

const links = (html: string) => html.match(/<a\b[^>]*>/g) ?? []

describe("deck card", () => {
  it("opens its deck from one link named by the deck, outside its buttons", () => {
    const html = renderToStaticMarkup(
      <DeckCard
        name="Project Atlas"
        edited="Edited just now"
        href="/deck/atlas"
        action={<DeckMenu name="Project Atlas" onTrash={() => undefined} />}
      />,
    )
    expect(links(html)).toHaveLength(1)
    const link = links(html)[0] ?? ""
    expect(link).toContain('href="/deck/atlas"')
    const named = /aria-labelledby="([^"]+)"/.exec(link)?.[1]
    expect(html).toContain(`<h2 id="${named ?? "none"}"`)
    expect(html).toMatch(/<a\b[^>]*><\/a>/)
  })

  it("opens nothing in Trash", () => {
    const html = renderToStaticMarkup(<DeckCard name="Project Atlas" edited="Deleted today, 30 days left" />)
    expect(links(html)).toHaveLength(0)
  })

  it("keeps Move to Trash in a menu named by the deck, not on the card", () => {
    const html = renderToStaticMarkup(
      <DeckCard
        name="Project Atlas"
        edited="Edited just now"
        href="/deck/atlas"
        action={<DeckMenu name="Project Atlas" onTrash={() => undefined} />}
      />,
    )
    expect(html).toContain('aria-label="Project Atlas actions"')
    expect(html).not.toContain("Move to Trash")
  })

  it("shows the deck's initial until its first slide is painted, never an empty preview", () => {
    const html = renderToStaticMarkup(<DeckCard name="quarterly review" edited="Edited just now" />)
    expect(html).toMatch(/data-deck-initial[^>]*>Q</)
  })
})
