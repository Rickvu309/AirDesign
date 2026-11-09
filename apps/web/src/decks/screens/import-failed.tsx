import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { ImportFailedPreview } from "@/decks/deck-status-preview"
import { recentDeckCards } from "@/decks/sample-decks"

const rest = recentDeckCards.slice(1)

export function ImportFailed() {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        <DeckCard
          name="Brightwater board review"
          edited="Unable to import"
          editedClassName="text-destructive"
          previewClassName="bg-background"
          preview={<ImportFailedPreview />}
        />
        {rest.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
    </DeckBrowser>
  )
}
