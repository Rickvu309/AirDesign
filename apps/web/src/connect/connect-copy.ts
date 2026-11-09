export const signedInAccount = {
  initials: "AL",
  name: "Ada Lovelace",
  email: "ada@halden.com",
} as const

export const connectPermissions = [
  "Read and edit all your decks",
  "Use your brand and files",
  "Import and export PowerPoint",
] as const

export const claudeConnect = {
  title: "Claude wants to use AirDesign",
  subtitle: "It can work on your decks for you.",
  ability: "Claude will be able to",
  footer: "Returns you to claude.ai. Uses your weekly usage. Disconnect anytime in Settings.",
  connectedTitle: "Connected",
  connectedSubtitle: "Taking you back to Claude",
  approveTitle: "S71.01 Agents / Connect / Approve Claude",
  connectedScreenTitle: "S71.02 Agents / Connect / Claude connected",
} as const

export const codexConnect = {
  title: "Codex wants to use AirDesign",
  subtitle: "It can work on your decks for you.",
  ability: "Codex will be able to",
  footer: "Returns you to Codex on this computer. Uses your weekly usage. Disconnect anytime in Settings.",
  approveTitle: "S71.03 Agents / Connect / Approve Codex",
} as const
