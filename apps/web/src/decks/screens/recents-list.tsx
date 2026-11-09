import { DeckBrowser } from "@/decks/deck-browser"
import { DeckTable } from "@/decks/deck-row"
import { recentDeckRows } from "@/decks/sample-decks"

export function RecentsList() {
  return (
    <DeckBrowser title="Recents" active="recents" view="list" scope="recents">
      <DeckTable rows={recentDeckRows} />
    </DeckBrowser>
  )
}
