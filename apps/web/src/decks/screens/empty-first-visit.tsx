import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { starterDeckCards } from "@/decks/sample-decks"

export function EmptyFirstVisit() {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents" firstVisit>
      <DeckGrid>
        {starterDeckCards.map((deck) => (
          <DeckCard
            key={deck.name}
            name={deck.name}
            edited={deck.edited}
            titleClassName="h-[var(--space-16)] leading-ui"
            editedClassName="h-[var(--space-16)] leading-ui-tight"
          />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
