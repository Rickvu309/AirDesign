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
            titleClassName="h-[18px] leading-[18px]"
            editedClassName="h-[17px] leading-[17px]"
          />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
