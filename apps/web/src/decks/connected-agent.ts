import type { ConnectMark } from "@/copy/connect-agent-copy"
import { settingsCopy } from "@/copy/settings-copy"

export type ConnectedAgent = {
  id: string
  name: string | null
  agent: "claude" | "claude-code" | "codex" | "gemini" | "other"
  host: string
  connected: string
}

export type AgentListing = {
  ok: true
  account: { email: string }
  mcp: string
  agents: ConnectedAgent[]
}

export function agentLabel(item: ConnectedAgent): string {
  if (item.agent === "claude") return settingsCopy.claude
  if (item.agent === "claude-code") return settingsCopy.claudeCode
  if (item.agent === "codex") return settingsCopy.codex
  if (item.agent === "gemini") return settingsCopy.gemini
  const trimmed = item.name?.trim() ?? ""
  return trimmed.length > 0 ? trimmed : item.host
}

export function agentMark(item: ConnectedAgent): ConnectMark {
  if (item.agent === "claude" || item.agent === "claude-code") return "claude"
  if (item.agent === "codex") return "chatgpt"
  if (item.agent === "gemini") return "gemini"
  return "other"
}
