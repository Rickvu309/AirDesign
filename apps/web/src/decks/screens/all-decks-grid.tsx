import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { recentDeckCards } from "@/decks/sample-decks"

export function AllDecksGrid() {
  return (
    <DeckBrowser title="All decks" active="all-decks" view="grid" scope="all">
      <DeckGrid className="mt-6">
        {recentDeckCards.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} previewClassName="h-[180px]" />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
