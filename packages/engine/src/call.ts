import { decide, openRegister, type Command, type Register, type Refusal } from "@airdesign/document"
import { notifyKey, readAgentEdit, readCommit, type DeckId, type WireEdit } from "@airdesign/catalog"

export type Deck = {
  readonly id: DeckId
  readonly revision: number
  readonly register: Register
}

export type Caller =
  | { readonly actor: "person" }
  | { readonly actor: "agent"; readonly runId: string; readonly readAt: number }

type CallRefusal = "field" | "deck" | "batch" | "base" | "stale" | "payload" | Refusal

type CallResult =
  | { readonly ok: true; readonly deck: Deck; readonly key: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

export function openDeck(id: DeckId): Deck {
  return { id, revision: 0, register: openRegister("", "") }
}

function refused(refusal: CallRefusal): { readonly ok: false; readonly refusal: CallRefusal } {
  return { ok: false, refusal }
}

function personCommand(edit: WireEdit): Command {
  if (edit.node === undefined) {
    return { command: "person", value: edit.value }
  }
  return { command: "person", value: edit.value, node: edit.node }
}

function agentCommand(edit: WireEdit, caller: { readonly runId: string; readonly readAt: number }): Command {
  if (edit.node === undefined) {
    return { command: "agent", runId: caller.runId, readAt: caller.readAt, value: edit.value }
  }
  return { command: "agent", runId: caller.runId, readAt: caller.readAt, value: edit.value, node: edit.node }
}

function applyEdits(deck: Deck, edits: readonly WireEdit[], commandFor: (edit: WireEdit) => Command): CallResult {
  let register = deck.register
  for (const edit of edits) {
    const decision = decide(register, commandFor(edit))
    if (decision.decision === "refuse") {
      return refused(decision.code)
    }
    register = decision.register
  }
  const revision = deck.revision + 1
  const notified = notifyKey(deck.id, revision)
  if (!notified.ok) {
    return refused("payload")
  }
  return { ok: true, deck: { id: deck.id, revision, register }, key: notified.key }
}

export function call(op: "commit_edits" | "edit_deck", deck: Deck, caller: Caller, raw: unknown): CallResult {
  if (op === "commit_edits") {
    if (caller.actor !== "person") {
      return refused("field")
    }
    const parsed = readCommit(raw)
    if (!parsed.ok) {
      return refused(parsed.refusal)
    }
    if (parsed.deck !== deck.id) {
      return refused("deck")
    }
    return applyEdits(deck, parsed.batch, personCommand)
  }
  if (caller.actor !== "agent") {
    return refused("field")
  }
  const parsed = readAgentEdit(raw)
  if (!parsed.ok) {
    return refused(parsed.refusal)
  }
  if (parsed.deck !== deck.id) {
    return refused("deck")
  }
  if (parsed.base !== deck.revision) {
    return refused("stale")
  }
  return applyEdits(deck, parsed.changes, (edit) => agentCommand(edit, caller))
}
