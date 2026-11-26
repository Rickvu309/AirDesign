import { deckRoutes } from "@/decks/deck-routes"
import { AiraStartScreen } from "@/decks/screens/aira-start"
import { AllDecksGrid } from "@/decks/screens/all-decks-grid"
import { AllDecksList } from "@/decks/screens/all-decks-list"
import { DeckMovedToast } from "@/decks/screens/deck-moved-toast"
import { EmptyFirstVisit } from "@/decks/screens/empty-first-visit"
import { NotFound } from "@/decks/not-found"
import { RecentsGrid } from "@/decks/screens/recents-grid"
import { RecentsList } from "@/decks/screens/recents-list"
import { TrashList } from "@/decks/screens/trash-list"

export const screens = {
  [deckRoutes.emptyFirstVisit]: EmptyFirstVisit,
  [deckRoutes.recentsGrid]: RecentsGrid,
  [deckRoutes.recentsList]: RecentsList,
  [deckRoutes.allDecksGrid]: AllDecksGrid,
  [deckRoutes.allDecksList]: AllDecksList,
  [deckRoutes.aira]: AiraStartScreen,
  [deckRoutes.deckMoved]: DeckMovedToast,
  [deckRoutes.deckNotFound]: function DeckNotFound() {
    return <NotFound kind="deck" />
  },
  [deckRoutes.addressNotFound]: function AddressNotFound() {
    return <NotFound kind="address" />
  },
  [deckRoutes.trash]: TrashList,
  [deckRoutes.emptyTrashConfirm]: function EmptyTrashConfirm() {
    return <TrashList confirm />
  },
}
