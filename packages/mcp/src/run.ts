import { readAgentEdit, type WireChange } from "@airdesign/catalog"
import { decide, type Decision, type ElementId, type Register } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import type { AgentCaller, ToolResult } from "./call-tool.js"
import { editRefusal, heldElements } from "./edit-answer.js"
import type { EditCode } from "./edit-next.js"

export function agentCaller(runId: string): AgentCaller {
  return { actor: "agent", runId }
}

function runningId(register: Register): string | undefined {
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body !== undefined && body.phase === "running" && body.runId !== null) return body.runId
  }
  return undefined
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

function openedElement(register: Register, change: WireChange, floors: ReadonlyMap<ElementId, string>): Decision {
  if (register.nodes.includes(change.node)) return { decision: "apply", register, route: register.route }
  return decide(register, {
    command: "add",
    node: change.node,
    floor: floors.get(change.node) ?? register.floor,
    route: register.route,
  })
}

function startedElement(
  register: Register,
  change: WireChange,
  floors: ReadonlyMap<ElementId, string>,
  candidate: () => string,
):
  | { readonly ok: true; readonly register: Register; readonly runId: string }
  | { readonly ok: false; readonly refusal: EditCode } {
  const opened = openedElement(register, change, floors)
  if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
  const body = opened.register.elements[change.node]
  if (body?.phase === "running" && body.runId !== null) {
    return { ok: true, register: opened.register, runId: body.runId }
  }
  const ended = body?.phase === "stopped" || body?.phase === "undone"
  const runId = ended ? candidate() : (runningId(opened.register) ?? candidate())
  const started = decide(opened.register, { command: "start", runId, node: change.node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  return { ok: true, register: started.register, runId }
}

export function openRun(
  register: Register,
  raw: unknown,
  mint: () => string,
):
  | { readonly ok: true; readonly register: Register; readonly caller: AgentCaller }
  | { readonly ok: false; readonly refusal: EditCode } {
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return { ok: false, refusal: parsed.refusal }
  const floors = elementFloors(register, parsed.changes)
  if (!floors.ok) return floors
  let next = register
  let minted: string | undefined
  const candidate = (): string => {
    minted ??= mint()
    return minted
  }
  let caller: AgentCaller | undefined
  for (const change of parsed.changes) {
    const started = startedElement(next, change, floors.floors, candidate)
    if (!started.ok) return started
    next = started.register
    caller ??= agentCaller(started.runId)
  }
  if (caller === undefined) return { ok: false, refusal: "batch" }
  return { ok: true, register: next, caller }
}

export function afterWrite(wrote: boolean, result: ToolResult, stored: Deck): ToolResult {
  if (!result.ok || wrote) return result
  const nodes = (result.answer?.elements ?? []).map((element) => element.node)
  const closed = heldElements(stored.register, nodes).some((element) => element.closed === true)
  return editRefusal(stored, closed ? "person-protected" : "stale", nodes)
}
