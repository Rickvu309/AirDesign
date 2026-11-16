export const signedInAccount = {
  initials: "AL",
  name: "Ada Lovelace",
  email: "ada@halden.com",
} as const

export const connectPermissions = ["Read and edit all your decks"] as const

export const claudeConnect = {
  title: "Claude wants to use AirDesign",
  subtitle: "It can work on your decks for you.",
  ability: "Claude will be able to",
  footer: "Returns you to claude.ai. Disconnect anytime in Settings.",
  connectedTitle: "Connected",
  connectedSubtitle: "Taking you back to Claude",
  approveTitle: "S71.01 Agents / Connect / Approve Claude",
  connectedScreenTitle: "S71.02 Agents / Connect / Claude connected",
} as const

export const codexConnect = {
  title: "Codex wants to use AirDesign",
  subtitle: "It can work on your decks for you.",
  ability: "Codex will be able to",
  footer: "Returns you to Codex on this computer. Disconnect anytime in Settings.",
  approveTitle: "S71.03 Agents / Connect / Approve Codex",
} as const

export const claudeCodeConnect = {
  title: "Claude Code wants to use AirDesign",
  subtitle: claudeConnect.subtitle,
  ability: "Claude Code will be able to",
  footer: "Returns you to Claude Code on this computer. Disconnect anytime in Settings.",
} as const

export const refusedConnect = {
  title: "This connection request is invalid",
  body: "Start connecting again from your agent, then approve its new request.",
  action: "Back to AirDesign",
} as const

export const unavailableConnect = {
  title: "Unable to finish connecting",
  body: "Check your connection and reload the consent page.",
  action: "Reload consent",
} as const

export function otherConnect(host: string) {
  return {
    title: `${host} wants to use AirDesign`,
    ability: `${host} will be able to`,
    footer: `Returns you to ${host}. Disconnect anytime in Settings.`,
  }
}

export function connectedCopy(name: string) {
  return {
    title: claudeConnect.connectedTitle,
    subtitle: name === "Claude" ? claudeConnect.connectedSubtitle : `Taking you back to ${name}`,
  }
}
