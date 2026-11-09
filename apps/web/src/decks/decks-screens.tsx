import { deckRoutes } from "@/decks/deck-routes"
import { AllDecksGrid } from "@/decks/screens/all-decks-grid"
import { AllDecksList } from "@/decks/screens/all-decks-list"
import { DeckMovedToast } from "@/decks/screens/deck-moved-toast"
import { EmptyFirstVisit } from "@/decks/screens/empty-first-visit"
import { ImportFailed } from "@/decks/screens/import-failed"
import { Importing } from "@/decks/screens/importing"
import { NewDeckMenuScreen } from "@/decks/screens/new-deck-menu"
import { RecentsGrid } from "@/decks/screens/recents-grid"
import { RecentsList } from "@/decks/screens/recents-list"
import { TrashList } from "@/decks/screens/trash-list"

export const screens = {
  [deckRoutes.emptyFirstVisit]: EmptyFirstVisit,
  [deckRoutes.recentsGrid]: RecentsGrid,
  [deckRoutes.recentsList]: RecentsList,
  [deckRoutes.allDecksGrid]: AllDecksGrid,
  [deckRoutes.allDecksList]: AllDecksList,
  [deckRoutes.newDeckMenu]: NewDeckMenuScreen,
  [deckRoutes.importing]: Importing,
  [deckRoutes.importFailed]: ImportFailed,
  [deckRoutes.deckMoved]: DeckMovedToast,
  [deckRoutes.trash]: TrashList,
  [deckRoutes.emptyTrashConfirm]: function EmptyTrashConfirm() {
    return <TrashList confirm />
  },
}
