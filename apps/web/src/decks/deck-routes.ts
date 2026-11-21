export const deckRoutes = {
  emptyFirstVisit: "/screens/s31-01-decks-browse-empty-first-visit",
  recentsGrid: "/screens/s31-02-decks-browse-recents-grid",
  recentsList: "/screens/s31-03-decks-browse-recents-list",
  allDecksGrid: "/screens/s31-04-decks-browse-all-decks-grid",
  allDecksList: "/screens/s31-05-decks-browse-all-decks-list",
  newDeckMenu: "/screens/s32-01-decks-new-deck-menu-open",
  importing: "/screens/s32-02-decks-new-deck-importing",
  importFailed: "/screens/s32-03-decks-new-deck-import-failed",
  templatePicker: "/screens/s32-04-decks-new-deck-template-picker",
  templateSlides: "/screens/s32-05-decks-new-deck-template-slides",
  deckMoved: "/screens/s33-01-decks-trash-deck-moved-toast",
  trash: "/screens/s33-02-decks-trash-list",
  emptyTrashConfirm: "/screens/s33-03-decks-trash-empty-trash-confirm",
  deckNotFound: "/screens/s34-01-decks-not-found-deck",
  addressNotFound: "/screens/s34-02-decks-not-found-address",
  settings: "/screens/s81-01-settings-settings-usage-tab",
  connectAgent: "/screens/s71-01-agents-connect-approve-claude",
} as const

export type DeckSection = "recents" | "all-decks" | "trash" | "settings"
