import { DeckBrowser } from "@/decks/deck-browser"
import { DeckCard, DeckGrid } from "@/decks/deck-card"
import { recentDeckCards } from "@/decks/sample-decks"
import { TemplatePicker } from "@/decks/template-picker"

function PickerOver({ shown }: { shown: string | null }) {
  return (
    <DeckBrowser title="Recents" active="recents" view="grid" scope="recents">
      <DeckGrid>
        {recentDeckCards.map((deck) => (
          <DeckCard key={deck.name} name={deck.name} edited={deck.edited} />
        ))}
      </DeckGrid>
      <TemplatePicker open shown={shown} onOpenChange={() => undefined} />
    </DeckBrowser>
  )
}

export function TemplatePickerScreen() {
  return <PickerOver shown={null} />
}

export function TemplateSlidesScreen() {
  return <PickerOver shown="midnight" />
}
