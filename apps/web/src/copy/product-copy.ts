export function usageResetsOn(when: string): string {
  return `Resets ${when}`
}

export function usageLimitBodyOn(when: string): string {
  return `${usageResetsOn(when)}. Your request is saved.`
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

const sampleReset = "Mon 8:00 AM"

export const productCopy = {
  noDecksTitle: "No decks yet",
  nameEmpty: "Enter a name for this deck.",
  rename: "Rename",
  renameDeck: "Rename deck",
  deckName: "Deck name",
  noMatchBody: "Check the spelling or search for another name.",
  clearSearch: "Clear search",
  noDecksBody: "Decks hold your slides, ready to edit or export to PowerPoint.",
  importPowerPoint: "Import PowerPoint",
  usageTitle: "Weekly usage",
  usageResets: usageResetsOn(sampleReset),
  usageResetAction: "Reset",
  usageLimitTitle: "You've hit this week's limit",
  usageLimitBody: usageLimitBodyOn(sampleReset),
  usageResetDone: "Usage reset. $5 used from your credits.",
  usageResetConfirmTitle: "Reset usage?",
  usageResetConfirmBody: "This uses $5 of your credits.",
  usagePercent: "62% used",
  agentResumeLine: "Pick up where you left off.",
  agentResume: "Resume",
  agentName: "Aira",
  creditsTitle: "Credits",
  creditsFacts: "Each reset is $5. Credits never expire.",
  creditsAdd: "Add credits",
  creditsMinimum: "Minimum $10.",
  autoTitle: "Auto reset",
  autoBody: "When usage runs out, reset for $5 from your credits.",
  payContinue: "Continue to payment",
  payNewTab: "Opens a secure page in a new tab.",
  payOpen: "Open payment page",
  payFailedTitle: "Unable to complete payment",
  payExpiredTitle: "Payment expired",
  payNotCharged: "Nothing was charged. Try again.",
  payTryAgain: "Try again",
  historyAdded: "Credits added",
  historyReset: "Usage reset",
  cancel: "Cancel",
  close: "Close",
  notNow: "Not now",
  done: "Done",
  undo: "Undo",
  exportFailed: "Unable to export. Your deck is unchanged.",
  exportFileMissing: "Unable to export. This deck's file could not be fetched. Check your connection.",
  exportEditsUnread: "Unable to export. This device could not read the deck's edits. Your deck is unchanged.",
  exportEditUnwritten:
    "Unable to export. One of this deck's edits could not be written to PowerPoint. Your deck is unchanged.",
  editorOffline: "You're offline. Edits are saved on this device.",
  editorUnreached: "Unable to reach AirDesign. Edits are saved on this device.",
  saved: "Saved",
  saving: "Saving…",
  savedOffline: "Offline, saved on this device",
  savedUnreached: "Unable to reach AirDesign",
  unsaved: "Unable to save",
  storageFailed: "Unable to save. AirDesign's storage failed, so edits are saved on this device. Reload to try again.",
  editsTooLarge:
    "Unable to save. These edits are larger than a deck allows, so they stay on this device. Export to keep a copy.",
  editsSetAside: "Unable to save some edits. The deck changed, so make them again if you need them.",
  editsLeftOut: "Unable to show some edits",
  editsLeftOutBody:
    "AirDesign can't write them into this deck's PowerPoint file, so the slides and an export leave them out. Your other edits still save.",
  editSetAsideTooLarge:
    "Unable to save an edit. It was too large to save, so an export of this deck does not include it.",
  editTooLarge: "Unable to save edits to this layer. It is too large to send, so it stays as it was.",
  trashEmptyBody: "This can't be undone.",
  trashEmptyAction: "Delete for good",
  importing: "Importing",
  moveToTrash: "Move to Trash",
  starred: "Starred",
  starredEmpty: "Star a deck to keep it here.",
  importChooseAnother: "Choose another file",
  importRemove: "Remove",
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
  blankDeck: "Blank deck",
  amount: "Amount",
  currentBalance: "Current balance",
  adding: "Adding",
  newBalance: "New balance",
  presetTen: "$10",
  presetTwentyFive: "$25",
  presetFifty: "$50",
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
