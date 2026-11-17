export const creditsCopy = {
  title: "Credits",
  facts: "Each reset is $5. Credits never expire.",
  purchases: "Adding credits isn’t available yet.",
  add: "Add credits",
  reset: "Reset",
  autoReset: "Auto reset",
  autoResetBody: "When usage runs out, reset for $5 from your credits.",
  history: "History",
  emptyHistory: "No usage resets yet.",
  historyLimit: "Your most recent usage resets.",
  resetEntry: "Usage reset",
  loading: "Loading credits…",
  failed: "Unable to load your credits. Check your connection and try again.",
  changeFailed: "Unable to save this change. Check your connection and try again.",
  insufficient: "You need $5 in credits to reset usage. Adding credits isn’t available yet.",
  active: "Aira is still working. Wait for it to finish, then try again.",
  empty: "Your usage has already reset. There’s no charge.",
  confirmTitle: "Reset usage for $5?",
  confirmBody: "This takes $5 from your credits and restores your Aira allowance. Your weekly reset stays the same.",
  confirm: "Reset for $5",
  done: "Usage reset",
} as const

export function creditAmount(cents: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD" }).format(cents / 100)
}

export function creditDate(at: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(at))
}
