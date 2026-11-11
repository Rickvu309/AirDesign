import {
  catalog,
  projectTools,
  readAgentEdit,
  readCapture,
  readRun,
  type AgentOp,
  type WireRefusal,
} from "@airdesign/catalog"
import { reach, type Tab } from "@airdesign/device"
import { call, type Caller, type Deck } from "@airdesign/engine"
import type { CallerLog, AdmissionText } from "./admit.js"
import { editLanded, editRefusal, namedNodes, runEnded, runRefusal, type EditAnswer } from "./edit-answer.js"
import { agentCaller, elementFloors, joinRun, openRun, stopLiveRuns } from "./run.js"
import { textProblem } from "./text-from.js"
import { liveTurn, type Turns } from "./turn.js"

export type AgentCaller = Extract<Caller, { readonly actor: "agent" }>

export type Session = {
  readonly caller: AgentCaller
  deck: Deck
  log: CallerLog
  now: number
  readonly turns: Turns
  readonly idleWindow?: number
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
      readonly refusal: WireRefusal | AdmissionText
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

function refused(deck: Deck, refusal: WireRefusal): ToolResult {
  return { ok: false, refusal, deck, content: [{ type: "text", text: refusal }] }
}

function reached(deck: Deck, refusal: WireRefusal, next: string): ToolResult {
  return { ok: false, refusal, deck, next, content: [{ type: "text", text: next }] }
}

function startedTurn(raw: unknown, session: Session) {
  const { deck } = session
  const turn = liveTurn(session, deck.id)
  if (turn !== undefined) return joinRun(deck.register, raw, turn.runId)
  return openRun(deck.register, raw, () => session.caller.runId)
}

function editDeck(raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return editRefusal(before, parsed.refusal, [])
  if (parsed.deck !== before.id) return editRefusal(before, "deck", [])
  const nodes = namedNodes(parsed.changes)
  const floors = elementFloors(before.register, parsed.changes)
  if (!floors.ok) return editRefusal(before, floors.refusal, nodes)
  const problem = textProblem(floors.floors, parsed.changes)
  if (problem !== undefined) return editRefusal(before, problem.code, nodes, problem.detail)
  const opened = startedTurn(raw, session)
  if (!opened.ok) return editRefusal(before, opened.refusal, nodes)
  const deck = { id: before.id, revision: before.revision, register: opened.register }
  const result = call("edit_deck", deck, opened.caller, raw)
  if (!result.ok) return { ...editRefusal(deck, result.refusal, nodes), deck: before }
  return editLanded(result.deck, nodes, opened.caller.runId)
}

function malformedRun(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false
  const body = raw as Record<string, unknown>
  return typeof body.runId === "string" && readRun({ ...body, runId: "run" }).ok
}

function stopRun(raw: unknown, session: Session): ToolResult {
  const before = session.deck
  const parsed = readRun(raw)
  if (!parsed.ok) return runRefusal(before, malformedRun(raw) ? "run-fenced" : parsed.refusal)
  if (parsed.deck !== before.id) return runRefusal(before, "deck")
  const result = call("stop_run", before, agentCaller(parsed.runId), raw)
  if (!result.ok) return runRefusal(before, result.refusal)
  const endsTurn = session.turns.read(before.id)?.runId === parsed.runId
  const ended = endsTurn ? stopLiveRuns(result.deck) : result
  if (!ended.ok) return runRefusal(before, ended.refusal)
  const deck = ended.deck.register === before.register ? before : { ...ended.deck, revision: before.revision + 1 }
  return runEnded(deck, parsed.runId)
}

function captureSlide(raw: unknown, session: Session): ToolResult {
  const parsed = readCapture(raw)
  if (!parsed.ok) return editRefusal(session.deck, parsed.refusal, [])
  if (parsed.deck !== session.deck.id) return refused(session.deck, "deck")
  const code = reach(session.tab ?? absentTab)
  if (code === "ready") return reached(session.deck, "device", nextStep.ready)
  return reached(session.deck, code, nextStep[code])
}

const handlers: Record<AgentOp, (raw: unknown, session: Session) => ToolResult> = {
  edit_deck: editDeck,
  stop_run: stopRun,
  capture_slide: captureSlide,
}

export function callTool(name: string, raw: unknown, session: Session): ToolResult {
  const tool = projectTools(catalog).find((item) => item.name === name)
  if (tool === undefined) return refused(session.deck, "field")
  return handlers[tool.op](raw, session)
}
