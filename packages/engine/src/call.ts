import {
  decide,
  elementId,
  limits,
  openRegister,
  type Command,
  type Decision,
  type ElementId,
  type NodeRegister,
  type Register,
  type Refusal,
} from "@airdesign/document"
import {
  notifyKey,
  readAgentEdit,
  readCommit,
  readRun,
  readRunStart,
  type DeckId,
  type WireChange,
  type WireEdit,
  type WireRunElement,
} from "@airdesign/catalog"

export type Deck = {
  readonly id: DeckId
  readonly revision: number
  readonly register: Register
}

export type Caller = { readonly actor: "person" } | { readonly actor: "agent"; readonly runId: string }

type CallRefusal = "field" | "deck" | "batch" | "base" | "stale" | "payload" | Refusal

type CallResult =
  | { readonly ok: true; readonly deck: Deck; readonly key: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

type StartResult =
  | { readonly ok: true; readonly deck: Deck; readonly key: string; readonly runId: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

type Touched = WireRunElement & {
  readonly value: string
}

export function openDeck(id: DeckId): Deck {
  return { id, revision: 0, register: openRegister("", "") }
}

function refused(refusal: CallRefusal): { readonly ok: false; readonly refusal: CallRefusal } {
  return { ok: false, refusal }
}

function personCommand(edit: WireEdit): Command {
  return { command: "person", value: edit.value, node: edit.node }
}

function agentCommand(edit: WireChange, runId: string): Command {
  return { command: "agent", runId, readAt: edit.readAt, value: edit.value, node: edit.node }
}

function utf8Length(value: string): number {
  let size = 0
  for (const symbol of value) {
    const code = symbol.codePointAt(0) ?? 0
    if (code <= 0x7f) size += 1
    else if (code <= 0x7ff) size += 2
    else if (code <= 0xffff) size += 3
    else size += 4
  }
  return size
}

function openedRegister(
  register: Register,
  edit: WireRunElement,
): { readonly ok: true; readonly register: Register } | { readonly ok: false; readonly refusal: CallRefusal } {
  if (register.nodes.includes(edit.node)) return { ok: true, register }
  const opened = decide(register, {
    command: "add",
    node: edit.node,
    floor: edit.floor ?? register.floor,
    route: register.route,
  })
  if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
  return { ok: true, register: opened.register }
}

const valueBytes = limits.valueBytes

function landed(deck: Deck, register: Register): CallResult {
  const changed = register !== deck.register
  const revision = changed ? deck.revision + 1 : deck.revision
  const notified = notifyKey(deck.id, revision)
  if (!notified.ok) return refused("payload")
  return { ok: true, deck: changed ? { id: deck.id, revision, register } : deck, key: notified.key }
}

function applyEdits<Edit extends Touched>(
  deck: Deck,
  edits: readonly Edit[],
  commandFor: (edit: Edit) => Command,
): CallResult {
  let register = deck.register
  for (const edit of edits) {
    if (utf8Length(edit.value) > valueBytes) return refused("limit")
    if (edit.floor !== undefined && utf8Length(edit.floor) > valueBytes) return refused("limit")
    const opened = openedRegister(register, edit)
    if (!opened.ok) return refused(opened.refusal)
    register = opened.register
    const next = register.bytes + utf8Length(edit.value)
    if (next >= limits.bytes) return refused("limit")
    const decision = decide(register, commandFor(edit))
    if (decision.decision === "refuse") return refused(decision.code)
    register = { ...decision.register, bytes: next }
  }
  return landed(deck, register)
}

function everyElement(register: Register): readonly ElementId[] {
  return [...new Set([...register.nodes, ...Object.keys(register.elements).map((key) => elementId(key))])]
}

function bodyOf(register: Register, node: ElementId): NodeRegister {
  return register.elements[node] ?? register
}

function isLive(body: NodeRegister | undefined, runId: string): boolean {
  return body?.phase === "running" && body.runId === runId
}

function holdsRun(body: NodeRegister, runId: string): boolean {
  return body.runId === runId || body.landed.some((row) => row.runId === runId)
}

function showsRun(body: NodeRegister, runId: string): boolean {
  if (body.runId === runId && body.phase !== "undone") return true
  return body.landed.some((row) => row.runId === runId && row.visible)
}

function decideOnElement(register: Register, node: ElementId, command: Command): Decision {
  if (register.nodes.includes(node)) return decide(register, command)
  const restored = decide(register, { command: "add", node, floor: register.floor, route: register.route })
  if (restored.decision === "refuse") return restored
  const decided = decide(restored.register, command)
  if (decided.decision === "refuse") return decided
  return decide(decided.register, { command: "remove", node })
}

function applyToElements(
  deck: Deck,
  nodes: readonly ElementId[],
  commandFor: (node: ElementId) => Command,
): CallResult {
  let register = deck.register
  for (const node of nodes) {
    const decision = decideOnElement(register, node, commandFor(node))
    if (decision.decision === "refuse") return refused(decision.code)
    register = decision.register
  }
  return landed(deck, register)
}

function liveRun(register: Register, elements: readonly WireRunElement[]): string | null {
  for (const { node } of elements) {
    const body = register.elements[node]
    if (body?.phase === "running") return body.runId
  }
  return null
}

function startRun(deck: Deck, requested: string, elements: readonly WireRunElement[]): StartResult {
  const runId = liveRun(deck.register, elements) ?? requested
  let register = deck.register
  for (const element of elements) {
    if (element.floor !== undefined && utf8Length(element.floor) > valueBytes) return refused("limit")
    const opened = openedRegister(register, element)
    if (!opened.ok) return refused(opened.refusal)
    register = opened.register
    if (isLive(register.elements[element.node], runId)) continue
    const started = decide(register, { command: "start", runId, node: element.node })
    if (started.decision === "refuse") return refused(started.code)
    register = started.register
  }
  const result = landed(deck, register)
  return result.ok ? { ...result, runId } : result
}

function stopRun(deck: Deck, runId: string): CallResult {
  const { register } = deck
  const nodes = everyElement(register)
  if (!nodes.some((node) => holdsRun(bodyOf(register, node), runId))) return refused("run-fenced")
  const live = nodes.filter((node) => isLive(bodyOf(register, node), runId))
  return applyToElements(deck, live, (node) => ({ command: "stop", runId, node }))
}

function undoRun(deck: Deck, runId: string): CallResult {
  const { register } = deck
  const shown = everyElement(register).filter((node) => showsRun(bodyOf(register, node), runId))
  if (shown.length === 0) return refused("run-fenced")
  return applyToElements(deck, shown, (node) => ({ command: "undo", runId, node }))
}

function namesOtherRun(caller: Caller, runId: string): boolean {
  return caller.actor === "agent" && caller.runId !== runId
}

function callStartRun(deck: Deck, caller: Caller, raw: unknown): StartResult {
  if (caller.actor !== "agent") return refused("field")
  const parsed = readRunStart(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  if (parsed.deck !== deck.id) return refused("deck")
  if (namesOtherRun(caller, parsed.runId)) return refused("run-fenced")
  return startRun(deck, parsed.runId, parsed.elements)
}

function callEndRun(deck: Deck, caller: Caller, raw: unknown, end: typeof stopRun): CallResult {
  const parsed = readRun(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  if (parsed.deck !== deck.id) return refused("deck")
  if (namesOtherRun(caller, parsed.runId)) return refused("run-fenced")
  return end(deck, parsed.runId)
}

export function call(op: "start_run", deck: Deck, caller: Caller, raw: unknown): StartResult
export function call(
  op: "commit_edits" | "edit_deck" | "stop_run" | "undo_run",
  deck: Deck,
  caller: Caller,
  raw: unknown,
): CallResult
export function call(
  op: "commit_edits" | "edit_deck" | "start_run" | "stop_run" | "undo_run",
  deck: Deck,
  caller: Caller,
  raw: unknown,
): CallResult | StartResult {
  if (op === "start_run") return callStartRun(deck, caller, raw)
  if (op === "undo_run") return callEndRun(deck, caller, raw, undoRun)
  if (op === "stop_run") {
    if (caller.actor !== "agent") return refused("field")
    return callEndRun(deck, caller, raw, stopRun)
  }
  if (op === "commit_edits") {
    if (caller.actor !== "person") return refused("field")
    const parsed = readCommit(raw)
    if (!parsed.ok) return refused(parsed.refusal)
    if (parsed.deck !== deck.id) return refused("deck")
    return applyEdits(deck, parsed.batch, personCommand)
  }
  if (caller.actor !== "agent") return refused("field")
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  if (parsed.deck !== deck.id) return refused("deck")
  return applyEdits(deck, parsed.changes, (edit) => agentCommand(edit, caller.runId))
}
