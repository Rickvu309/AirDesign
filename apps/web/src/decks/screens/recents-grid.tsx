import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { recentDeckCards } from "@/decks/sample-decks"

export function RecentsGrid() {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        {recentDeckCards.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
