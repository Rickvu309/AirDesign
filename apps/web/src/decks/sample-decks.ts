export type DeckCardData = {
  name: string
  edited: string
}

export type DeckRowData = {
  name: string
  edited: string
  created: string
}

export const account = {
  name: "Ada Lovelace",
  initials: "AL",
}

export const starredFolders = ["Project Atlas", "Q3 Investor Update", "FY26 Operating Plan"]

export const recentDeckCards: DeckCardData[] = [
  { name: "Project Atlas", edited: "Edited just now" },
  { name: "Q3 Investor Update", edited: "Edited 2 hours ago" },
  { name: "FY26 Operating Plan", edited: "Edited yesterday" },
  { name: "Pricing Strategy Review", edited: "Edited last week" },
  { name: "Board Pack, October", edited: "Edited 3 weeks ago" },
  { name: "Germany Market Sizing", edited: "Edited last month" },
]

export const recentDeckRows: DeckRowData[] = [
  { name: "Project Atlas", edited: "Just now", created: "Oct 30" },
  { name: "Q3 Investor Update", edited: "2 hours ago", created: "Oct 21" },
  { name: "FY26 Operating Plan", edited: "Yesterday", created: "Sep 12" },
  { name: "Pricing Strategy Review", edited: "Last week", created: "Sep 3" },
  { name: "Board Pack, October", edited: "3 weeks ago", created: "Aug 28" },
  { name: "Germany Market Sizing", edited: "Last month", created: "Aug 4" },
]

export const starterDeckCards: DeckCardData[] = [
  { name: "Scratchpad", edited: "Your first draft" },
  { name: "Welcome to AirDesign", edited: "A sample board proposal" },
]

export const trashDeckCards: DeckCardData[] = [
  { name: "Old pitch draft", edited: "Deleted 2 days ago, 28 days left" },
  { name: "Brightwater kickoff", edited: "Deleted last week, 23 days left" },
  { name: "Scratchpad copy", edited: "Deleted 3 weeks ago, 9 days left" },
]

export const movedDeckCards: DeckCardData[] = recentDeckCards.filter((deck) => deck.name !== "Pricing Strategy Review")
