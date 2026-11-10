import { catalog, projectTools, readCapture } from "@airdesign/catalog"
import { reach, type Tab } from "@airdesign/device"
import { call, type Caller, type Deck } from "@airdesign/engine"
import type { CallerLog } from "./admit.js"
import { openRun } from "./run.js"

export type AgentCaller = Extract<Caller, { readonly actor: "agent" }>

export type Session = {
  readonly caller: AgentCaller
  deck: Deck
  log: CallerLog
  now: number
  readonly tab?: Tab
}

export type ToolContent = {
  readonly type: "text"
  readonly text: string
}

export type ToolResult =
  | {
      readonly ok: true
      readonly deck: Deck
      readonly content: readonly ToolContent[]
    }
  | {
      readonly ok: false
      readonly refusal: string
      readonly deck: Deck
      readonly content: readonly ToolContent[]
      readonly next?: string
    }

const nextStep = {
  "no-open-tab": "Open the deck in AirDesign, then try again.",
  "tab-hidden": "Show the AirDesign tab, then try again.",
  "tab-timeout": "The tab did not answer. Show the AirDesign tab, then try again.",
  "tab-outdated": "Reload the AirDesign tab, then try again.",
  ready: "Capture runs in the open tab. This server did not capture a slide.",
} as const

const absentTab: Tab = { presence: "absent" }

function refused(deck: Deck, refusal: string): ToolResult {
  return { ok: false, refusal, deck, content: [{ type: "text", text: refusal }] }
}

function reached(deck: Deck, refusal: string, next: string): ToolResult {
  return { ok: false, refusal, deck, next, content: [{ type: "text", text: next }] }
}

function editDeck(raw: unknown, session: Session): ToolResult {
  const opened = openRun(session.deck.register, raw, () => session.caller.runId)
  if (!opened.ok) return refused(session.deck, opened.refusal)
  const deck = { id: session.deck.id, revision: session.deck.revision, register: opened.register }
  const result = call("edit_deck", deck, opened.caller, raw)
  if (!result.ok) return refused(session.deck, result.refusal)
  return {
    ok: true,
    deck: result.deck,
    content: [{ type: "text", text: `Landed revision ${String(result.deck.revision)}.` }],
  }
}

function captureSlide(raw: unknown, session: Session): ToolResult {
  const parsed = readCapture(raw)
  if (!parsed.ok) return refused(session.deck, parsed.refusal)
  const code = reach(session.tab ?? absentTab)
  if (code === "ready") return reached(session.deck, "device", nextStep.ready)
  return reached(session.deck, code, nextStep[code])
}

export function callTool(name: string, raw: unknown, session: Session): ToolResult {
  const tool = projectTools(catalog).find((item) => item.name === name)
  if (tool === undefined) return refused(session.deck, "field")
  if (tool.op === "edit_deck" && tool.runsOn === "server") return editDeck(raw, session)
  if (tool.op === "capture_slide" && tool.runsOn === "device") return captureSlide(raw, session)
  return refused(session.deck, "field")
}
