import { editDeck } from "./edit-tool.js"
import { elementTool } from "./element-tool.js"
import { slideTool } from "./slide-tool.js"
import { catalog, projectTools, readRun, type AgentOp, type WireRefusal } from "@airdesign/catalog"
import {
  call,
  type Caller,
  type Deck,
  type ListDeckAnswer,
  type OwnedDeck,
  type ReadDeckAnswer,
} from "@airdesign/engine"
import type { CallerLog, AdmissionText } from "./admit.js"
import { editRefusal, runEnded, runRefusal, type EditAnswer } from "./edit-answer.js"
import { agentCaller, stopLiveRuns } from "./run.js"
import type { EditCode } from "./edit-next.js"
import { listDecksTool, readDeckTool } from "./read-tool.js"
import { liveTurn, type Turn, type Turns } from "./turn.js"

export type AgentCaller = Extract<Caller, { readonly actor: "agent" }>

export type Session = {
  readonly caller: AgentCaller
  deck: Deck
  log: CallerLog
  now: number
  readonly turns: Turns
  once?: string | undefined
  readonly idleWindow?: number
  owned?: readonly OwnedDeck[]
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
      readonly reported?: ReadDeckAnswer | ListDeckAnswer
    }
  | {
      readonly ok: false
      readonly refusal: WireRefusal | AdmissionText
      readonly deck: Deck
      readonly content: readonly ToolContent[]
      readonly answer?: EditAnswer
    }

function refused(deck: Deck, refusal: WireRefusal): ToolResult {
  return { ok: false, refusal, deck, content: [{ type: "text", text: refusal }] }
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
  if (!session.turns.owns(parsed.runId)) return runRefusal(before, "run-fenced")
  const result = call("stop_run", before, agentCaller(parsed.runId), raw)
  if (!result.ok) return runRefusal(before, result.refusal)
  const endsTurn = session.turns.read(before.id)?.runId === parsed.runId
  const ended = endsTurn ? stopLiveRuns(result.deck, session.turns.owns) : result
  if (!ended.ok) return runRefusal(before, ended.refusal)
  const deck = ended.deck.register === before.register ? before : { ...ended.deck, revision: before.revision + 1 }
  return runEnded(deck, parsed.runId)
}

export const agentOps: Record<
  AgentOp,
  {
    handle: (raw: unknown, session: Session) => ToolResult
    refuse: (deck: Deck, code: EditCode) => ToolResult
    turnRun: (answer: Extract<EditAnswer, { ok: true }>, held: Turn | undefined) => string | null | undefined
  }
> = {
  add_slide: {
    handle: (raw, session) => slideTool("add_slide", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  duplicate_slide: {
    handle: (raw, session) => slideTool("duplicate_slide", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  delete_slide: {
    handle: (raw, session) => slideTool("delete_slide", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  move_slide: {
    handle: (raw, session) => slideTool("move_slide", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  add_text_box: {
    handle: (raw, session) => elementTool("add_text_box", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  delete_element: {
    handle: (raw, session) => elementTool("delete_element", raw, session),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  edit_deck: {
    handle: editDeck,
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: (answer) => answer.runId,
  },
  stop_run: {
    handle: stopRun,
    refuse: runRefusal,
    turnRun: (answer, held) => (answer.runId === held?.runId ? null : undefined),
  },
  read_deck: {
    handle: (raw, session) => readDeckTool(raw, session, liveTurn(session, session.deck.id)?.runId ?? null),
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: () => undefined,
  },
  list_decks: {
    handle: listDecksTool,
    refuse: (deck, code) => editRefusal(deck, code, []),
    turnRun: () => undefined,
  },
}

export function callTool(name: string, raw: unknown, session: Session): ToolResult {
  const tool = projectTools(catalog).find((item) => item.name === name)
  if (tool === undefined) return refused(session.deck, "field")
  return agentOps[tool.op].handle(raw, session)
}
