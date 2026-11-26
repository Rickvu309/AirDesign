export function usageResetsOn(when: string): string {
  return `Resets ${when}`
}

export function noMatchTitleOf(query: string): string {
  return `No decks match “${query}”`
}

export function decksFoundOf(count: number): string {
  return count === 1 ? "1 deck found" : `${new Intl.NumberFormat("en").format(count)} decks found`
}

export function nameTooLongOf(limit: number): string {
  return `Use ${new Intl.NumberFormat("en").format(limit)} characters or fewer.`
}

export function starOf(name: string): string {
  return `Star ${name}`
}

export function unstarOf(name: string): string {
  return `Remove star from ${name}`
}

export function deckActionsOf(name: string): string {
  return `${name} actions`
}

export function starredOf(name: string): string {
  return `Starred ${name}`
}

export function unstarredOf(name: string): string {
  return `Removed star from ${name}`
}

export function movingOf(name: string): string {
  return `Moving ${name} to Trash`
}

export function restoringOf(name: string): string {
  return `Restoring ${name}`
}

export function restoredOf(name: string): string {
  return `Restored ${name}`
}

export function moveFailedOf(name: string): string {
  return `Unable to move ${name} to Trash`
}

export function restoreFailedOf(name: string): string {
  return `Unable to restore ${name}`
}

export function tabTitleOf(name: string): string {
  return `${name} - AirDesign`
}

export function disconnectTitleOf(agent: string): string {
  return `Disconnect ${agent}?`
}

export function disconnectBodyOf(agent: string): string {
  return `${agent} can no longer read or edit your decks. You can connect it again at any time.`
}

export function emptyTrashTitleOf(count: number): string {
  const decks = new Intl.PluralRules("en").select(count) === "one" ? "deck" : "decks"
  return `Delete ${new Intl.NumberFormat("en").format(count)} ${decks} for good?`
}

export const productCopy = {
  noDecksTitle: "No decks yet",
  nameEmpty: "Enter a name for this deck.",
  rename: "Rename",
  renameDeck: "Rename deck",
  deckName: "Deck name",
  noMatchBody: "Check the spelling or search for another name.",
  clearSearch: "Clear search",
  noDecksBody: "Decks hold your slides, ready to edit and present.",
  usageTitle: "Weekly usage",
  usageLimitTitle: "You've hit this week's limit",
  agentName: "Aira",
  payTryAgain: "Try again",
  cancel: "Cancel",
  close: "Close",
  done: "Done",
  undo: "Undo",
  exportFailed: "Unable to export. Your deck is unchanged.",
  editorOffline: "You're offline. Edits are saved on this device.",
  editorUnreached: "Unable to reach AirDesign. Edits are saved on this device.",
  saved: "Saved",
  saving: "Saving…",
  savedOffline: "Offline, saved on this device",
  savedUnreached: "Unable to reach AirDesign",
  unsaved: "Unable to save",
  storageFailed: "Unable to keep edits on this device. Keep this tab open until they save.",
  editsTooLarge:
    "Unable to save. These edits are larger than a deck allows, so they stay on this device. Export to keep a copy.",
  editsSetAside: "Unable to save some edits. The deck changed, so make them again if you need them.",
  editSetAside: "Unable to save an edit. The deck changed, so make it again if you need it.",
  textRefused: "Unable to save this text. Your words are kept here, so you can copy them or try again.",
  editSetAsideTooLarge: "Unable to save an edit. It was too large to save, so it was undone.",
  trashEmptyBody: "This can't be undone.",
  trashEmptyAction: "Delete for good",
  moveToTrash: "Move to Trash",
  starred: "Starred",
  starredEmpty: "Star a deck to keep it here.",
  deckOpenFailed: "Unable to open this deck",
  goToDecks: "Go to your decks",
  deckNotFoundTitle: "Deck not found",
  deckNotFoundBody: "It may have been deleted, or it may belong to another account.",
  addressNotFoundTitle: "Page not found",
  addressNotFoundBody: "Check the address and try again.",
  newerVersion: "AirDesign has a new version",
  reload: "Reload",
  decksFailedTitle: "Unable to load your decks",
  decksFailedBody: "Check your connection and try again.",
  deleteFailed: "Unable to delete these decks. Check your connection and try again.",
  agentsFailed: "Unable to load your agents. Check your connection and try again.",
  disconnect: "Disconnect",
  disconnectFailed: "Unable to disconnect. Check your connection and try again.",
  newDeck: "New deck",
  describeDeck: "Describe your deck",
  describeDeckExample: "The quarter in five numbers, for the board",
  storyHeadline: "What story do you want to tell?",
  moreIdeas: "More ideas",
  makeDeck: "Make deck",
  exportDeck: "Export",
  blankDeck: "Blank deck",
} as const

export const zoomCopy = {
  field: "Zoom",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Zoom to fit",
  selection: "Zoom to selection",
  inKey: "Ctrl+=",
  outKey: "Ctrl+-",
  fitKey: "Shift+1",
  hundredKey: "Shift+0",
  selectionKey: "Shift+2",
} as const

export function zoomToOf(percent: number): string {
  return `Zoom to ${String(percent)}%`
}
