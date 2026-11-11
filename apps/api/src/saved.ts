import type { DeckAnswers } from "./deck-answer.js"
import { notifyKey, type DeckId, type WireEdit, type WireRefusal } from "@airdesign/catalog"
import { foldRegister, type StoredRegister } from "@airdesign/document"
import { call, openDeck, type Deck } from "@airdesign/engine"

import type { Sql } from "./pool.js"

const readSql = "select id, revision, register, owner, deleted is not null as deleted from deck.saved where id = $1"

const insertSql = `
with inserted as (
  insert into deck.saved (id, revision, register, owner)
  values ($1, $2, $3::jsonb, $4)
  on conflict (id) do nothing
  returning id, revision, register, owner, false as deleted
)
select inserted.id, inserted.revision, inserted.register, inserted.owner, inserted.deleted, pg_notify('deck', $5) as notified
from inserted
`

const revisionSql = `
with updated as (
  update deck.saved
  set revision = $2, register = $3::jsonb, edited = now()
  where id = $1 and revision = $4 and deleted is null
  returning id, revision, register
)
select updated.id, updated.revision, updated.register, pg_notify('deck', $5) as notified
from updated
`

const onceReadSql = "select revision, notify from deck.once where email = $1 and deck = $2 and once = $3"

const revisionOnceSql = `
with updated as (
  update deck.saved
  set revision = $2, register = $3::jsonb, edited = now()
  where id = $1 and revision = $4 and deleted is null
  returning id, revision, register
),
noted as (
  insert into deck.once (email, deck, once, revision, notify)
  select $6, updated.id, $7, updated.revision, $5
  from updated
  returning notify
)
select noted.notify, pg_notify('deck', noted.notify) as notified
from noted
`

type Saved = {
  readonly id: string
  readonly revision: number
  readonly owner: string
} & (
  | { readonly deleted: false; readonly register: Deck["register"] }
  | { readonly deleted: true; readonly register: null }
)

type LiveSaved = Extract<Saved, { readonly deleted: false }>

export function deckAccess(
  saved: Saved,
  email: string,
): { readonly ok: true; readonly saved: LiveSaved } | { readonly ok: false; readonly refusal: "owner" | "deleted" } {
  if (saved.owner !== email) return { ok: false, refusal: "owner" }
  if (saved.deleted) return { ok: false, refusal: "deleted" }
  return { ok: true, saved }
}

export type RevisionWrite = {
  readonly id: string
  readonly revision: number
  readonly register: Deck["register"]
  readonly expected: number
  readonly key: string
  readonly once?: {
    readonly email: string
    readonly once: string
  }
}

type StoredOnce = {
  readonly revision: number
  readonly notify: string
}

function uniqueOnce(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

async function readStoredOnce(db: Sql, email: string, deck: string, once: string): Promise<StoredOnce | undefined> {
  const result = await db.query<StoredOnce>(onceReadSql, [email, deck, once])
  return result.rows[0]
}

type StoredSaved = Omit<Saved, "register" | "deleted"> &
  ({ readonly deleted: false; readonly register: StoredRegister } | { readonly deleted: true; readonly register: null })

function savedFrom(row: StoredSaved | undefined): Saved | undefined {
  if (row === undefined) return undefined
  if (row.deleted) return row
  return {
    id: row.id,
    revision: row.revision,
    register: foldRegister(row.register),
    owner: row.owner,
    deleted: row.deleted,
  }
}

export async function readSaved(db: Sql, id: string): Promise<Saved | undefined> {
  const result = await db.query<StoredSaved>(readSql, [id])
  return savedFrom(result.rows[0])
}

export function chosenRevision(cursor: number | null, current: number | undefined): number | undefined {
  if (current === undefined) return undefined
  if (cursor === null) return current
  if (current > cursor) return cursor + 1
  return undefined
}

function openedRow(
  deck: DeckId,
  saved: Saved,
  owner: string,
):
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly register: Deck["register"] }
  | { readonly ok: false; readonly refusal: "owner" | "deleted" } {
  const access = deckAccess(saved, owner)
  if (!access.ok) return access
  return { ok: true, deck, revision: access.saved.revision, register: access.saved.register }
}

export async function openSaved(
  db: Sql,
  parsed: { readonly deck: DeckId },
  owner: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly register: Deck["register"] }
  | { readonly ok: false; readonly refusal: "deck" | "owner" | "deleted" }
> {
  const existing = await readSaved(db, parsed.deck)
  if (existing !== undefined) return openedRow(parsed.deck, existing, owner)
  const opened = openDeck(parsed.deck)
  const key = notifyKey(opened.id, opened.revision)
  if (!key.ok) return { ok: false, refusal: "deck" }
  const inserted = await db.query<StoredSaved>(insertSql, [
    opened.id,
    opened.revision,
    JSON.stringify(opened.register),
    owner,
    key.key,
  ])
  const created = savedFrom(inserted.rows[0])
  if (created !== undefined) return openedRow(parsed.deck, created, owner)
  const raced = await readSaved(db, parsed.deck)
  if (raced === undefined) return { ok: false, refusal: "deck" }
  return openedRow(parsed.deck, raced, owner)
}

export async function writeRevision(db: Sql, input: RevisionWrite): Promise<boolean> {
  if (input.once === undefined) {
    const result = await db.query(revisionSql, [
      input.id,
      input.revision,
      JSON.stringify(input.register),
      input.expected,
      input.key,
    ])
    return result.rows.length > 0
  }
  const result = await db.query(revisionOnceSql, [
    input.id,
    input.revision,
    JSON.stringify(input.register),
    input.expected,
    input.key,
    input.once.email,
    input.once.once,
  ])
  return result.rows.length > 0
}

export type Commit = {
  readonly deck: DeckId
  readonly batch: readonly WireEdit[]
  readonly once?: string
}

export async function commitEdits(
  db: Sql,
  parsed: Commit,
  owner: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly revision: number; readonly key: string }
  | { readonly ok: false; readonly refusal: WireRefusal }
> {
  const wire = {
    deck: parsed.deck,
    batch: parsed.batch,
    ...(parsed.once === undefined ? {} : { once: parsed.once }),
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const read = await readSaved(db, parsed.deck)
    if (read === undefined) return { ok: false, refusal: "deck" }
    const access = deckAccess(read, owner)
    if (!access.ok) return access
    const saved = access.saved
    if (parsed.once !== undefined) {
      const prior = await readStoredOnce(db, owner, parsed.deck, parsed.once)
      if (prior !== undefined) {
        return { ok: true, deck: parsed.deck, revision: prior.revision, key: prior.notify }
      }
    }
    const current: Deck = { id: saved.id as DeckId, revision: saved.revision, register: saved.register }
    const result = call("commit_edits", current, { actor: "person" }, wire)
    if (!result.ok) return { ok: false, refusal: result.refusal }
    try {
      const wrote = await writeRevision(db, {
        id: result.deck.id,
        revision: result.deck.revision,
        register: result.deck.register,
        expected: saved.revision,
        key: result.key,
        ...(parsed.once === undefined ? {} : { once: { email: owner, once: parsed.once } }),
      })
      if (wrote) {
        return { ok: true, deck: result.deck.id, revision: result.deck.revision, key: result.key }
      }
    } catch (error) {
      if (parsed.once === undefined || !uniqueOnce(error)) throw error
    }
  }
  return { ok: false, refusal: "stale" }
}

export const savedAnswers = {
  open: openSaved,
  commit: commitEdits,
} satisfies Partial<DeckAnswers>
