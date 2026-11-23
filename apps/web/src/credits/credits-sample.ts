export const creditsCopy = {
  waiting: "Waiting for your $25.00 payment. Finish in the new tab.",
  addedTitle: "$25.00 added",
  addedBody: "Your balance is now $40.00. Receipt sent to your email.",
} as const

export const addedHistory = [
  { date: "Nov 4", what: "Credits added", amount: "+$25.00" },
  { date: "Nov 3", what: "Usage reset", amount: "-$5.00" },
  { date: "Oct 28", what: "Credits added", amount: "+$20.00" },
] as const

export const amountEntry = {
  balance: "$15.00",
  adding: "$25.00",
  next: "$40.00",
  amount: "25",
  selected: 25,
} as const

export const addedBalance = "$40.00"
