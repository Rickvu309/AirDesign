import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { DeckActions } from "@/decks/deck-menu"
import { recentDeckCards } from "@/decks/sample-decks"
import { SampleSlide } from "@/decks/screens/sample-slide"

export function AllDecksGrid() {
  return (
    <DeckBrowser title="All decks" active="all-decks" view="grid" scope="all">
      <DeckGrid className="mt-6">
        {recentDeckCards.map((deck) => (
          <DeckCard
            key={deck.name}
            name={deck.name}
            edited={deck.edited}
            previewClassName="h-[180px]"
            href="#"
            preview={<SampleSlide name={deck.name} />}
            action={<DeckActions name={deck.name} starred={false} onStar={() => undefined} onTrash={() => undefined} />}
          />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
