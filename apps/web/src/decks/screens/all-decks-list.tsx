import { DeckBrowser } from "@/decks/deck-browser"
import { DeckTable } from "@/decks/deck-row"
import { recentDeckRows } from "@/decks/sample-decks"

export function AllDecksList() {
  return (
    <DeckBrowser title="All decks" active="all-decks" view="list" scope="all">
      <DeckTable rows={recentDeckRows} />
    </DeckBrowser>
  )
}
