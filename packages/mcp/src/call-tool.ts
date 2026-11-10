import { catalog, projectTools, readAgentEdit, readCapture } from "@airdesign/catalog"
import { reach, type Tab } from "@airdesign/device"
import { call, type Caller, type Deck } from "@airdesign/engine"
import type { CallerLog } from "./admit.js"
import { editLanded, editRefusal, namedNodes, type EditAnswer } from "./edit-answer.js"
import { openRun } from "./run.js"
import { textProblem } from "./text-from.js"

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
      readonly answer?: EditAnswer
    }
  | {
      readonly ok: false
      readonly refusal: string
      readonly deck: Deck
      readonly content: readonly ToolContent[]
      readonly next?: string
      readonly answer?: EditAnswer
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
  const before = session.deck
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  if (parsed.deck !== before.id) return editRefusal(before, "deck", [])
  const nodes = namedNodes(parsed.changes)
  const problem = textProblem(before.register, parsed.changes)
  if (problem !== undefined) return editRefusal(before, problem.code, nodes, problem.detail)
  const opened = openRun(before.register, raw, () => session.caller.runId)
  if (!opened.ok) return editRefusal(before, opened.refusal, nodes)
  const deck = { id: before.id, revision: before.revision, register: opened.register }
  const result = call("edit_deck", deck, opened.caller, raw)
  if (!result.ok) return editRefusal(before, result.refusal, nodes)
  return editLanded(result.deck, nodes)
}

function captureSlide(raw: unknown, session: Session): ToolResult {
  const parsed = readCapture(raw)
  if (!parsed.ok) return refused(session.deck, parsed.refusal)
  if (parsed.deck !== session.deck.id) return refused(session.deck, "deck")
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
