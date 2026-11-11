import {
  bytesOf,
  decide,
  storedElements,
  limits,
  openRegister,
  type Command,
  type Decision,
  type ElementId,
  type NodeRegister,
  type Register,
} from "@airdesign/document"
import {
  notifyKey,
  readAgentEdit,
  readCommit,
  readRun,
  readRunStart,
  type CallRefusal,
  type CommandOp,
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
    if (bytesOf(edit.value) > limits.valueBytes) return refused("limit")
    if (edit.floor !== undefined && bytesOf(edit.floor) > limits.valueBytes) return refused("limit")
    const opened = openedRegister(register, edit)
    if (!opened.ok) return refused(opened.refusal)
    register = opened.register
    const next = register.bytes + bytesOf(edit.value)
    if (next >= limits.bytes) return refused("limit")
    const decision = decide(register, commandFor(edit))
    if (decision.decision === "refuse") return refused(decision.code)
    register = { ...decision.register, bytes: next }
  }
  return landed(deck, register)
}

function everyElement(register: Register): readonly ElementId[] {
  return [...new Set([...register.nodes, ...storedElements(register)])]
}

function bodyOf(register: Register, node: ElementId): NodeRegister {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
}

function holdsRun(body: NodeRegister, runId: string): boolean {
  return body.runId === runId || body.landed.some((row) => row.runId === runId)
}

function showsRows(body: NodeRegister, runId: string): boolean {
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

function isLive(register: Register, node: ElementId, runId: string): boolean {
  return decideOnElement(register, node, { command: "stop", runId, node }).decision === "apply"
}

function endOnTouched(
  deck: Deck,
  command: "stop" | "undo",
  runId: string,
  fencedStillRefuses: (body: NodeRegister) => boolean,
): CallResult {
  const touched = everyElement(deck.register).filter((node) => holdsRun(bodyOf(deck.register, node), runId))
  if (touched.length === 0) return refused("run-fenced")
  let register = deck.register
  for (const node of touched) {
    const decision = decideOnElement(register, node, { command, runId, node })
    if (decision.decision === "apply") {
      register = decision.register
      continue
    }
    if (decision.code !== "run-fenced" || fencedStillRefuses(bodyOf(register, node))) return refused(decision.code)
  }
  return landed(deck, register)
}

function runLiveOn(register: Register, node: ElementId): string | null {
  const runId = register.elements[node]?.runId ?? null
  return runId !== null && isLive(register, node, runId) ? runId : null
}

function liveRun(register: Register, elements: readonly WireRunElement[]): string | null {
  for (const { node } of elements) {
    const runId = runLiveOn(register, node)
    if (runId !== null) return runId
  }
  return null
}

export function liveRuns(deck: Deck): readonly string[] {
  const runs = everyElement(deck.register).map((node) => runLiveOn(deck.register, node))
  return [...new Set(runs.filter((runId) => runId !== null))]
}

function startRun(deck: Deck, requested: string, elements: readonly WireRunElement[]): StartResult {
  const runId = liveRun(deck.register, elements) ?? requested
  let register = deck.register
  for (const element of elements) {
    if (element.floor !== undefined && bytesOf(element.floor) > limits.valueBytes) return refused("limit")
    const opened = openedRegister(register, element)
    if (!opened.ok) return refused(opened.refusal)
    register = opened.register
    if (isLive(register, element.node, runId)) continue
    const started = decide(register, { command: "start", runId, node: element.node })
    if (started.decision === "refuse") return refused(started.code)
    register = started.register
  }
  const result = landed(deck, register)
  return result.ok ? { ...result, runId } : result
}

function stopRun(deck: Deck, runId: string): CallResult {
  return endOnTouched(deck, "stop", runId, () => false)
}

function undoRun(deck: Deck, runId: string): CallResult {
  const result = endOnTouched(deck, "undo", runId, (body) => showsRows(body, runId))
  if (result.ok && result.deck === deck) return refused("run-fenced")
  return result
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
export function call(op: Exclude<CommandOp, "start_run">, deck: Deck, caller: Caller, raw: unknown): CallResult
export function call(op: CommandOp, deck: Deck, caller: Caller, raw: unknown): CallResult | StartResult {
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
