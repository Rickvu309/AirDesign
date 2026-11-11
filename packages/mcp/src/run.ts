import { readAgentEdit, type WireChange, type WireRunElement } from "@airdesign/catalog"
import type { ElementId, Register } from "@airdesign/document"
import { call, liveRuns, type Deck } from "@airdesign/engine"
import type { AgentCaller, ToolResult } from "./call-tool.js"
import { editRefusal, heldElements, runRefusal } from "./edit-answer.js"
import type { EditCode } from "./edit-next.js"

export function agentCaller(runId: string): AgentCaller {
  return { actor: "agent", runId }
}

export type ElementFloors =
  | { readonly ok: true; readonly floors: ReadonlyMap<ElementId, string> }
  | { readonly ok: false; readonly refusal: "field" }

export function elementFloors(register: Register, changes: readonly WireChange[]): ElementFloors {
  const floors = new Map<ElementId, string>()
  const named = new Map<ElementId, string | undefined>()
  for (const change of changes) {
    const kept = register.elements[change.node]
    if (kept !== undefined) {
      floors.set(change.node, kept.floor)
      continue
    }
    if (!named.has(change.node)) {
      named.set(change.node, change.floor)
      floors.set(change.node, change.floor ?? register.floor)
      continue
    }
    if (change.floor !== undefined && change.floor !== named.get(change.node)) return { ok: false, refusal: "field" }
  }
  return { ok: true, floors }
}

type Opened =
  | { readonly ok: true; readonly register: Register; readonly caller: AgentCaller }
  | { readonly ok: false; readonly refusal: EditCode }

type RunRequest =
  | { readonly ok: true; readonly deck: Deck; readonly elements: readonly WireRunElement[] }
  | { readonly ok: false; readonly refusal: EditCode }

function runElements(changes: readonly WireChange[]): readonly WireRunElement[] {
  const elements = new Map<ElementId, WireRunElement>()
  for (const { node, floor } of changes) {
    if (!elements.has(node)) elements.set(node, floor === undefined ? { node } : { node, floor })
  }
  return [...elements.values()]
}

function runRequest(register: Register, raw: unknown): RunRequest {
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return parsed
  const floors = elementFloors(register, parsed.changes)
  if (!floors.ok) return floors
  return { ok: true, deck: { id: parsed.deck, revision: 0, register }, elements: runElements(parsed.changes) }
}

function startRun(deck: Deck, elements: readonly WireRunElement[], runId: string) {
  return call("start_run", deck, agentCaller(runId), { deck: deck.id, runId, elements })
}

function underRun(started: ReturnType<typeof startRun>): Opened {
  if (!started.ok) return started
  return { ok: true, register: started.deck.register, caller: agentCaller(started.runId) }
}

export function joinRun(register: Register, raw: unknown, runId: string): Opened {
  const request = runRequest(register, raw)
  if (!request.ok) return request
  return underRun(startRun(request.deck, request.elements, runId))
}

export function stopLiveRuns(
  deck: Deck,
): { readonly ok: true; readonly deck: Deck } | { readonly ok: false; readonly refusal: EditCode } {
  let current = deck
  for (const runId of liveRuns(deck)) {
    const stopped = call("stop_run", current, agentCaller(runId), { deck: deck.id, runId })
    if (!stopped.ok) return stopped
    current = stopped.deck
  }
  return { ok: true, deck: current }
}

export function openRun(register: Register, raw: unknown, mint: () => string): Opened {
  const request = runRequest(register, raw)
  if (!request.ok) return request
  const stopped = stopLiveRuns(request.deck)
  if (!stopped.ok) return stopped
  return underRun(startRun(stopped.deck, request.elements, mint()))
}

export function afterWrite(wrote: boolean, result: ToolResult, stored: Deck): ToolResult {
  if (!result.ok || wrote) return result
  const nodes = (result.answer?.elements ?? []).map((element) => element.node)
  if (nodes.length === 0) return runRefusal(stored, "stale")
  const closed = heldElements(stored.register, nodes).some((element) => element.closed === true)
  return editRefusal(stored, closed ? "person-protected" : "stale", nodes)
}
