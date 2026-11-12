export function usageResetsOn(when: string): string {
  return `Resets ${when}`
}

export function usageLimitBodyOn(when: string): string {
  return `${usageResetsOn(when)}. Your request is saved.`
}

export function noMatchTitleOf(query: string): string {
  return `No decks match “${query}”`
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
  editorOffline: "You're offline. Edits are saved on this device.",
  trashEmptyBody: "This can't be undone.",
  trashEmptyAction: "Delete for good",
  importing: "Importing",
  moveToTrash: "Move to Trash",
  importChooseAnother: "Choose another file",
  importRemove: "Remove",
  deckOpenFailed: "Unable to open this deck",
  goToDecks: "Go to your decks",
  decksFailedTitle: "Unable to load your decks",
  decksFailedBody: "Check your connection and try again.",
  deleteFailed: "Unable to delete these decks. Check your connection and try again.",
  agentsFailed: "Unable to load your agents. Check your connection and try again.",
  disconnect: "Disconnect",
  disconnectFailed: "Unable to disconnect. Check your connection and try again.",
  blankDeck: "Blank deck",
  amount: "Amount",
  currentBalance: "Current balance",
  adding: "Adding",
  newBalance: "New balance",
  presetTen: "$10",
  presetTwentyFive: "$25",
  presetFifty: "$50",
} as const

export const airaStarters: readonly string[] = []
