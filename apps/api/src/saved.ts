import { notifyKey, readCapture, readCommit, type DeckId } from "@airdesign/catalog"
import { call, openDeck, type Deck } from "@airdesign/engine"

import type { Sql } from "./pool.js"

const readSql = "select revision, register from deck.saved where id = $1"

const insertSql = `
with inserted as (
  insert into deck.saved (id, revision, register)
  values ($1, $2, $3::jsonb)
  on conflict (id) do nothing
  returning id, revision, register
)
select inserted.id, inserted.revision, inserted.register, pg_notify('deck', $4) as notified
from inserted
`

const revisionSql = `
with updated as (
  update deck.saved
  set revision = $2, register = $3::jsonb
  where id = $1 and revision = $4
  returning id, revision, register
)
select updated.id, updated.revision, updated.register, pg_notify('deck', $5) as notified
from updated
`

type Saved = {
  readonly revision: number
  readonly register: Deck["register"]
}

export type RevisionWrite = {
  readonly id: string
  readonly revision: number
  readonly register: Deck["register"]
  readonly expected: number
  readonly key: string
}

function savedFrom(row: { revision: number; register: Deck["register"] } | undefined): Saved | undefined {
  if (row === undefined) return undefined
  return { revision: row.revision, register: row.register }
}

export async function readSaved(db: Sql, id: string): Promise<Saved | undefined> {
  const result = await db.query<{ revision: number; register: Deck["register"] }>(readSql, [id])
  return savedFrom(result.rows[0])
}

export function chosenRevision(cursor: number | null, current: number | undefined): number | undefined {
  if (current === undefined) return undefined
  if (cursor === null) return current
  if (current > cursor) return cursor + 1
  return undefined
}

export async function openSaved(
  db: Sql,
  raw: unknown,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly register: Deck["register"] }
  | { readonly ok: false; readonly refusal: "field" | "deck" }
> {
  const parsed = readCapture(raw)
  if (!parsed.ok) return parsed
  const existing = await readSaved(db, parsed.deck)
  if (existing !== undefined) {
    return { ok: true, deck: parsed.deck, revision: existing.revision, register: existing.register }
  }
  const opened = openDeck(parsed.deck)
  const key = notifyKey(opened.id, opened.revision)
  if (!key.ok) return { ok: false, refusal: "deck" }
  const inserted = await db.query<{ revision: number; register: Deck["register"] }>(insertSql, [
    opened.id,
    opened.revision,
    JSON.stringify(opened.register),
    key.key,
  ])
  const created = savedFrom(inserted.rows[0])
  if (created !== undefined) {
    return { ok: true, deck: parsed.deck, revision: created.revision, register: created.register }
  }
  const raced = await readSaved(db, parsed.deck)
  if (raced === undefined) return { ok: false, refusal: "deck" }
  return { ok: true, deck: parsed.deck, revision: raced.revision, register: raced.register }
}

export async function writeRevision(db: Sql, input: RevisionWrite): Promise<boolean> {
  const result = await db.query(revisionSql, [
    input.id,
    input.revision,
    JSON.stringify(input.register),
    input.expected,
    input.key,
  ])
  return result.rows.length > 0
}

export async function commitEdits(
  db: Sql,
  raw: unknown,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly key: string }
  | { readonly ok: false; readonly refusal: string }
> {
  const parsed = readCommit(raw)
  if (!parsed.ok) return { ok: false, refusal: parsed.refusal }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const saved = await readSaved(db, parsed.deck)
    if (saved === undefined) return { ok: false, refusal: "deck" }
    const current: Deck = { id: parsed.deck, revision: saved.revision, register: saved.register }
    const result = call("commit_edits", current, { actor: "person" }, raw)
    if (!result.ok) return { ok: false, refusal: result.refusal }
    const wrote = await writeRevision(db, {
      id: result.deck.id,
      revision: result.deck.revision,
      register: result.deck.register,
      expected: saved.revision,
      key: result.key,
    })
    if (wrote) {
      return { ok: true, deck: result.deck.id, revision: result.deck.revision, key: result.key }
    }
  }
  return { ok: false, refusal: "stale" }
}
