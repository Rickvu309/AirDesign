import type { DeckId } from "@airdesign/catalog"

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

type Refusal = "owner"

const expireSql = `
with removed as (delete from deck.saved
where owner = $1 and trashed is not null and trashed < now() - interval '30 days'
returning original_key, original_until, owner),
queued as (
  insert into deck.original_delete (key, owner, expires)
  select original_key, owner, coalesce(original_until, now()) from removed where original_key is not null
  on conflict (key) do nothing
)
select original_key from removed where original_key is not null
`

const listSql = `
select id, name, edited, created, trashed
from deck.saved
where owner = $1
order by edited desc, created desc, id
`

const renameSql = "update deck.saved set name = $3 where id = $1 and owner = $2 returning id, name"

const trashSql = `
update deck.saved set trashed = coalesce(trashed, now())
where id = $1 and owner = $2
returning id, trashed
`

const restoreSql = "update deck.saved set trashed = null where id = $1 and owner = $2 returning id"

const deleteSql = `
with removed as (delete from deck.saved
where owner = $1 and id = any($2::text[]) and trashed is not null
returning id, original_key, original_until, owner),
queued as (
  insert into deck.original_delete (key, owner, expires)
  select original_key, owner, coalesce(original_until, now()) from removed where original_key is not null
  on conflict (key) do nothing
)
select id, original_key from removed
`

function listed(row: ListRow): Listed {
  return {
    deck: row.id as DeckId,
    name: row.name,
    edited: row.edited.toISOString(),
    created: row.created.toISOString(),
  }
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
  const expired = await db.query<{ original_key: string }>(expireSql, [email])
  await discardOriginals(
    db,
    expired.rows.map((row) => row.original_key),
    store,
  )
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
  if (row === undefined) return { ok: false, refusal: "owner" }
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
  if (row === undefined) return { ok: false, refusal: "owner" }
  return { ok: true, deck: parsed.deck, trashed: row.trashed.toISOString() }
}

export async function restoreDeck(
  db: Sql,
  parsed: { readonly deck: DeckId },
  email: string,
): Promise<{ readonly ok: true; readonly deck: DeckId } | { readonly ok: false; readonly refusal: Refusal }> {
  const result = await db.query(restoreSql, [parsed.deck, email])
  if (result.rows.length === 0) return { ok: false, refusal: "owner" }
  return { ok: true, deck: parsed.deck }
}

export async function deleteDecks(
  db: Sql,
  parsed: { readonly decks: readonly DeckId[] },
  email: string,
  store?: OriginalStore,
): Promise<{ readonly ok: true; readonly deleted: string[] }> {
  const result = await db.query<{ id: string; original_key: string | null }>(deleteSql, [email, parsed.decks])
  await discardOriginals(
    db,
    result.rows.flatMap((row) => (row.original_key === null ? [] : [row.original_key])),
    store,
  )
  const gone = new Set(result.rows.map((row) => row.id))
  return { ok: true, deleted: parsed.decks.filter((deck) => gone.has(deck)) }
}
