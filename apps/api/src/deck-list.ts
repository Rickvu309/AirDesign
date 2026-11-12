import type { DeckAnswers } from "./deck-answer.js"
import type { DeckId } from "@airdesign/catalog"
import type { OwnedRow } from "@airdesign/engine"

import type { Sql } from "./pool.js"
import { discardOriginals, drainOriginals } from "./original.js"
import type { OriginalStore } from "./original-store.js"

type Listed = {
  readonly deck: DeckId
  readonly name: string
  readonly edited: string
  readonly created: string
}

type ListedTrash = Listed & { readonly trashed: string }

type ListRow = {
  readonly id: string
  readonly name: string
  readonly edited: Date
  readonly created: Date
  readonly trashed: Date | null
}

type Refusal = "owner" | "deleted"

const clearedColumns = `deleted = now(), register = null, import_index = null, name = '', trashed = null, original_key = null,
  original_bytes = null, original_sha256 = null, original_stored = false, original_until = null`

function deletedSql(doomed: string): string {
  return `
with doomed as (
  select id, original_key, original_until, owner from deck.saved
  where ${doomed} and trashed is not null and deleted is null
  for update
),
removed as (
  update deck.saved set ${clearedColumns}
  from doomed where deck.saved.id = doomed.id
  returning doomed.id, doomed.original_key, doomed.original_until, doomed.owner
),
queued as (
  insert into deck.original_delete (key, owner, expires)
  select original_key, owner, coalesce(original_until, now()) from removed where original_key is not null
  on conflict (key) do nothing
),
media_queued as (
  insert into deck.original_delete (key, owner, expires)
  select media.key, removed.owner, now() + interval '15 minutes' from deck.media join removed on media.deck = removed.id
  on conflict (key) do nothing
),
media_removed as (
  delete from deck.media using removed where deck.media.deck = removed.id
)
select id, original_key, pg_notify('deck', id) as notified from removed
`
}

const expireSql = deletedSql("owner = $1 and trashed < now() - interval '30 days'")

const deleteSql = deletedSql("owner = $1 and id = any($2::text[])")

const onceClearSql = "delete from deck.once where deck = any($1::text[])"

const missedSql = "select deleted is not null as deleted from deck.saved where id = $1 and owner = $2"

const listSql = `
select id, name, edited, created, trashed
from deck.saved
where owner = $1 and deleted is null
order by edited desc, created desc, id
`

const ownedSql = `
select id, name, owner, deleted is not null as deleted, trashed is not null as trash
from deck.saved
where owner = $1 and deleted is null
order by edited desc, created desc, id
`

const renameSql = "update deck.saved set name = $3 where id = $1 and owner = $2 and deleted is null returning id, name"

const trashSql = `
update deck.saved set trashed = coalesce(trashed, now())
where id = $1 and owner = $2 and deleted is null
returning id, trashed
`

const restoreSql = "update deck.saved set trashed = null where id = $1 and owner = $2 and deleted is null returning id"

type Removed = { readonly id: string; readonly original_key: string | null }

async function removeDecks(db: Sql, sql: string, values: readonly unknown[], store?: OriginalStore): Promise<string[]> {
  const result = await db.query<Removed>(sql, [...values])
  const ids = result.rows.map((row) => row.id)
  if (ids.length > 0) await db.query(onceClearSql, [ids])
  await discardOriginals(
    db,
    result.rows.flatMap((row) => (row.original_key === null ? [] : [row.original_key])),
    store,
  )
  return ids
}

async function missed(
  db: Sql,
  deck: DeckId,
  email: string,
): Promise<{ readonly ok: false; readonly refusal: Refusal }> {
  const result = await db.query<{ deleted: boolean }>(missedSql, [deck, email])
  return { ok: false, refusal: result.rows[0]?.deleted === true ? "deleted" : "owner" }
}

function listed(row: ListRow): Listed {
  return {
    deck: row.id as DeckId,
    name: row.name,
    edited: row.edited.toISOString(),
    created: row.created.toISOString(),
  }
}

type OwnedSql = {
  readonly id: string
  readonly name: string
  readonly owner: string
  readonly deleted: boolean
  readonly trash: boolean
}

export async function readOwnedDecks(db: Sql, email: string): Promise<OwnedRow[]> {
  const result = await db.query<OwnedSql>(ownedSql, [email])
  return result.rows.map((row) => ({
    deck: row.id,
    name: row.name,
    owner: row.owner,
    deleted: row.deleted === true,
    trash: row.trash === true,
  }))
}

export async function listDecks(
  db: Sql,
  email: string,
  store?: OriginalStore,
): Promise<{
  readonly ok: true
  readonly account: { readonly email: string }
  readonly decks: Listed[]
  readonly trash: ListedTrash[]
}> {
  await removeDecks(db, expireSql, [email], store)
  await drainOriginals(db, store, { owner: email })
  const result = await db.query<ListRow>(listSql, [email])
  const decks: Listed[] = []
  const trash: ListedTrash[] = []
  for (const row of result.rows) {
    if (row.trashed === null) decks.push(listed(row))
    else trash.push({ ...listed(row), trashed: row.trashed.toISOString() })
  }
  return { ok: true, account: { email }, decks, trash }
}

export async function renameDeck(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly name: string },
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly name: string }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const result = await db.query<{ name: string }>(renameSql, [parsed.deck, email, parsed.name])
  const row = result.rows[0]
  if (row === undefined) return missed(db, parsed.deck, email)
  return { ok: true, deck: parsed.deck, name: row.name }
}

export async function trashDeck(
  db: Sql,
  parsed: { readonly deck: DeckId },
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly trashed: string }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const result = await db.query<{ trashed: Date }>(trashSql, [parsed.deck, email])
  const row = result.rows[0]
  if (row === undefined) return missed(db, parsed.deck, email)
  return { ok: true, deck: parsed.deck, trashed: row.trashed.toISOString() }
}

export async function restoreDeck(
  db: Sql,
  parsed: { readonly deck: DeckId },
  email: string,
): Promise<{ readonly ok: true; readonly deck: DeckId } | { readonly ok: false; readonly refusal: Refusal }> {
  const result = await db.query(restoreSql, [parsed.deck, email])
  if (result.rows.length === 0) return missed(db, parsed.deck, email)
  return { ok: true, deck: parsed.deck }
}

export async function deleteDecks(
  db: Sql,
  parsed: { readonly decks: readonly DeckId[] },
  email: string,
  store?: OriginalStore,
): Promise<{ readonly ok: true; readonly deleted: string[] }> {
  const gone = new Set(await removeDecks(db, deleteSql, [email, parsed.decks], store))
  return { ok: true, deleted: parsed.decks.filter((deck) => gone.has(deck)) }
}

export const deckListAnswers = {
  list: (db, _, email, store) => listDecks(db, email, store),
  rename: renameDeck,
  trash: trashDeck,
  restore: restoreDeck,
  delete: deleteDecks,
} satisfies Partial<DeckAnswers>
