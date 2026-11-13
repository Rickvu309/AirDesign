import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { ImportingPreview } from "@/decks/deck-status-preview"
import { recentDeckCards } from "@/decks/sample-decks"

const rest = recentDeckCards.slice(1)

export function Importing() {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        <DeckCard
          name="Brightwater board review"
          edited="Importing, slide 14 of 24"
          editedClassName="text-[var(--primary-strong)]"
          previewClassName="bg-background"
          preview={<ImportingPreview />}
        />
        {rest.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
