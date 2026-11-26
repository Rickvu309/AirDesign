export const connectAgentCopy = {
  title: "Connect an agent",
  body: "Your agent can make and edit your decks.",
  agents: "Agent",
  ways: "App",
  copy: "Copy",
  copyPrompt: "Copy prompt",
  copyFailed: "Unable to copy",
  copyManually: "Text selected. Copy it with your keyboard or selection menu.",
  addressStep: "Copy the address",
  allowStep: "Choose Allow",
  loadFailed: "Unable to load your address. Check your connection and try again.",
  connectedBody: "It can read and edit all your decks.",
} as const

export function promptStepOf(agent: string): string {
  return `Paste this into ${agent}`
}

export function addStepOf(agent: string): string {
  return `Add it in ${agent}`
}

export function signInStepOf(agent: string): string {
  return `${agent} adds AirDesign and tells you how to sign in.`
}

export function waitingOf(agent: string): string {
  return `Waiting for ${agent} to connect.`
}

export function connectedOf(agent: string): string {
  return `${agent} is connected`
}

export function setupPromptOf(address: string): string {
  return `Add AirDesign as an MCP server named airdesign at ${address} over HTTP, for all my projects. Then tell me how to sign in.`
}

type AddressWay = {
  kind: "address"
  add: string
  open?: { label: string; href: string }
}

type PromptWay = { kind: "prompt" }

export type ConnectWay = (AddressWay | PromptWay) & {
  id: string
  tab: string
  name: string
}

export type ConnectMark = "claude" | "chatgpt" | "gemini" | "antigravity" | "other"

export type ConnectChoice = {
  id: string
  name: string
  mark: ConnectMark
  ways: readonly ConnectWay[]
}

export const connectChoices: readonly ConnectChoice[] = [
  {
    id: "claude",
    name: "Claude",
    mark: "claude",
    ways: [
      {
        id: "claude-app",
        tab: "Claude app",
        name: "Claude",
        kind: "address",
        add: "Add it as a custom connector, then choose Allow.",
        open: { label: "Open Claude connectors", href: "https://claude.ai/customize/connectors" },
      },
      { id: "claude-code", tab: "Claude Code", name: "Claude Code", kind: "prompt" },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    mark: "chatgpt",
    ways: [
      {
        id: "chatgpt-app",
        tab: "ChatGPT app",
        name: "ChatGPT",
        kind: "address",
        add: "Add it as a custom MCP server, then choose Allow.",
        open: { label: "Open ChatGPT plugins", href: "https://chatgpt.com/plugins" },
      },
      { id: "codex", tab: "Codex", name: "Codex", kind: "prompt" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    mark: "gemini",
    ways: [
      { id: "gemini-cli", tab: "Gemini CLI", name: "Gemini CLI", kind: "prompt" },
      { id: "antigravity", tab: "Antigravity", name: "Antigravity", kind: "prompt" },
    ],
  },
  {
    id: "other",
    name: "Other",
    mark: "other",
    ways: [
      {
        id: "other",
        tab: "Other",
        name: "your agent",
        kind: "address",
        add: "Add it as an MCP server, then choose Allow.",
      },
    ],
  },
]
