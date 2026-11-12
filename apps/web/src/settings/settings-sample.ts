import { settingsCopy as words } from "@/copy/settings-copy"

export const settingsCopy = {
  ...words,
  weeklyUsage: "Weekly usage",
  resets: "Resets Mon 8:00 AM",
  reset: "Reset",
  used: "62% used",
  credits: "Credits",
  balance: "$15.00",
  facts: "Each reset is $5. Credits never expire.",
  addCredits: "Add credits",
  autoReset: "Auto reset",
  autoResetBody: "When usage runs out, reset for $5 from your credits.",
  history: "History",
  aira: "Aira",
  airaStatus: "Built in. Uses your weekly usage faster.",
  manage: "Manage",
  connect: "Connect",
  mcpAddress: "https://mcp.airdesign.app/mcp",
  setupGuides: "Setup guides for Claude and Codex",
  profile: "Profile",
  profileLine: "Ada Lovelace, ada@halden.com",
  edit: "Edit",
  preferences: "Preferences",
  language: "Language",
  english: "English",
  slideSize: "Slide size",
  slideSizeBody: "For new decks",
  slideRatio: "16:9",
  email: "ada@halden.com",
} as const

export const usageHistory = [
  { date: "Nov 3", what: "Usage reset", amount: "-$5.00" },
  { date: "Oct 28", what: "Credits added", amount: "+$20.00" },
] as const
