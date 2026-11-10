import type { NodeName } from "@airdesign/document"

declare const deckIdBrand: unique symbol

export type DeckId = string & { readonly [deckIdBrand]: true }

export type WireEdit = {
  readonly value: string
  readonly node?: NodeName
  readonly actor?: never
  readonly command?: never
  readonly principal?: never
  readonly person?: never
  readonly agent?: never
  readonly surface?: never
  readonly onBehalfOf?: never
}

export type LiveKey = {
  readonly deck: DeckId
  readonly revision: number
}

const named = { a: true, b: true } satisfies Record<NodeName, true>
const deckPattern = /^[A-Za-z0-9_-]{1,64}$/
const revisionPattern = /^(?:0|[1-9][0-9]*)$/
const batchCap = 100
const notifyCap = 8000

type FieldRefusal = { ok: false; refusal: "field" }
type DeckRefusal = { ok: false; refusal: "deck" }
type BatchRefusal = { ok: false; refusal: "batch" }
type CursorRefusal = { ok: false; refusal: "cursor" }
type BaseRefusal = { ok: false; refusal: "base" }
type PayloadRefusal = { ok: false; refusal: "payload" }

const fieldRefusal: FieldRefusal = { ok: false, refusal: "field" }
const deckRefusal: DeckRefusal = { ok: false, refusal: "deck" }
const batchRefusal: BatchRefusal = { ok: false, refusal: "batch" }
const cursorRefusal: CursorRefusal = { ok: false, refusal: "cursor" }
const baseRefusal: BaseRefusal = { ok: false, refusal: "base" }
const payloadRefusal: PayloadRefusal = { ok: false, refusal: "payload" }

function recordOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function knownKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const key of Object.keys(body)) {
    if (!keys.includes(key)) return false
  }
  return true
}

function whole(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 0) return undefined
  return raw
}

function nodeOf(raw: unknown): NodeName | undefined {
  if (typeof raw !== "string" || !Object.hasOwn(named, raw)) return undefined
  return raw as NodeName
}

function utf8Size(text: string): number {
  let size = 0
  for (const symbol of text) {
    const code = symbol.codePointAt(0) ?? 0
    if (code <= 0x7f) size += 1
    else if (code <= 0x7ff) size += 2
    else if (code <= 0xffff) size += 3
    else size += 4
  }
  return size
}

export function readDeckId(raw: unknown): { ok: true; deck: DeckId } | DeckRefusal {
  if (typeof raw !== "string" || !deckPattern.test(raw)) return deckRefusal
  return { ok: true, deck: raw as DeckId }
}

export function readEdit(raw: unknown): { ok: true; edit: WireEdit } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["value", "node"]) || typeof body.value !== "string") return fieldRefusal
  if (!Object.hasOwn(body, "node")) return { ok: true, edit: { value: body.value } }
  const node = nodeOf(body.node)
  if (node === undefined) return fieldRefusal
  return { ok: true, edit: { value: body.value, node } }
}

function readBatch(raw: unknown): { ok: true; edits: readonly WireEdit[] } | FieldRefusal | BatchRefusal {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > batchCap) return batchRefusal
  const edits: WireEdit[] = []
  for (const item of raw) {
    const edit = readEdit(item)
    if (!edit.ok) return fieldRefusal
    edits.push(edit.edit)
  }
  return { ok: true, edits }
}

export function readCommit(
  raw: unknown,
): { ok: true; deck: DeckId; batch: readonly WireEdit[] } | FieldRefusal | DeckRefusal | BatchRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "batch"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (!Object.hasOwn(body, "batch")) return batchRefusal
  const batch = readBatch(body.batch)
  if (!batch.ok) return batch
  return { ok: true, deck: deck.deck, batch: batch.edits }
}

export function readWatch(
  raw: unknown,
): { ok: true; deck: DeckId; cursor: number | null } | FieldRefusal | DeckRefusal | CursorRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "cursor"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  if (!Object.hasOwn(body, "cursor")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (body.cursor === null) return { ok: true, deck: deck.deck, cursor: null }
  const cursor = whole(body.cursor)
  if (cursor === undefined) return cursorRefusal
  return { ok: true, deck: deck.deck, cursor }
}

export function readAgentEdit(
  raw: unknown,
):
  | { ok: true; deck: DeckId; base: number; changes: readonly WireEdit[] }
  | FieldRefusal
  | DeckRefusal
  | BaseRefusal
  | BatchRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "base", "changes"]) || !Object.hasOwn(body, "deck")) {
    return fieldRefusal
  }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  if (!Object.hasOwn(body, "base")) return baseRefusal
  const base = whole(body.base)
  if (base === undefined) return baseRefusal
  if (!Object.hasOwn(body, "changes")) return batchRefusal
  const changes = readBatch(body.changes)
  if (!changes.ok) return changes
  return { ok: true, deck: deck.deck, base, changes: changes.edits }
}

export function readCapture(raw: unknown): { ok: true; deck: DeckId } | FieldRefusal | DeckRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck"]) || !Object.hasOwn(body, "deck")) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deckRefusal
  return { ok: true, deck: deck.deck }
}

export function notifyKey(deck: string, revision: number): { ok: true; key: string } | PayloadRefusal {
  if (whole(revision) === undefined) return payloadRefusal
  const key = `${deck}:${String(revision)}`
  if (utf8Size(key) >= notifyCap) return payloadRefusal
  return { ok: true, key }
}

export function parseNotifyKey(key: string): ({ ok: true } & LiveKey) | PayloadRefusal {
  if (utf8Size(key) >= notifyCap) return payloadRefusal
  const split = key.indexOf(":")
  if (split <= 0 || key.lastIndexOf(":") !== split) return payloadRefusal
  const deckText = key.slice(0, split)
  const revisionText = key.slice(split + 1)
  const deck = readDeckId(deckText)
  if (!deck.ok || !revisionPattern.test(revisionText)) return payloadRefusal
  const revision = Number(revisionText)
  if (!Number.isSafeInteger(revision) || revision < 0) return payloadRefusal
  return { ok: true, deck: deck.deck, revision }
}
