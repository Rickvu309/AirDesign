export function usageResetsOn(when: string): string {
  return `Resets ${when}`
}

export function usageLimitBodyOn(when: string): string {
  return `${usageResetsOn(when)}. Your request is saved.`
}

const sampleReset = "Monday at 8:00 AM"

export const productCopy = {
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
  agentCaution: "Aira can be wrong. Check a number, a quote, or a slide before you rely on it.",
  agentFailedTitle: "Unable to finish this run",
  agentFailedBody: "Your work so far is saved.",
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
  importFailedTitle: "Unable to import this file",
  importChooseAnother: "Choose another file",
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
