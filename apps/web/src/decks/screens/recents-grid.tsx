import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { DeckActions } from "@/decks/deck-menu"
import { recentDeckCards } from "@/decks/sample-decks"
import { SampleSlide } from "@/decks/screens/sample-slide"

export function RecentsGrid() {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        {recentDeckCards.map((deck) => (
          <DeckCard
            key={deck.name}
            name={deck.name}
            edited={deck.edited}
            href="#"
            preview={<SampleSlide name={deck.name} />}
            action={<DeckActions name={deck.name} starred={false} onStar={() => undefined} onTrash={() => undefined} />}
          />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
