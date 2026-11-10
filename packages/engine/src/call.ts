import { decide, limits, openRegister, type Command, type Register, type Refusal } from "@airdesign/document"
import { notifyKey, readAgentEdit, readCommit, type DeckId, type WireChange, type WireEdit } from "@airdesign/catalog"

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

type Touched = {
  readonly value: string
  readonly node: WireEdit["node"]
  readonly floor?: string
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
  edit: Touched,
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
  const revision = deck.revision + 1
  const notified = notifyKey(deck.id, revision)
  if (!notified.ok) return refused("payload")
  return { ok: true, deck: { id: deck.id, revision, register }, key: notified.key }
}

export function call(op: "commit_edits" | "edit_deck", deck: Deck, caller: Caller, raw: unknown): CallResult {
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
