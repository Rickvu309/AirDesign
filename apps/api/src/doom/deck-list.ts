import type { DeckAnswers } from "../platform/deck-answer.js"
import type { DeckId } from "@airdesign/catalog"

import type { Sql } from "../platform/pool.js"
import { drainOriginals } from "./original.js"
import type { OriginalStore } from "../platform/original-store.js"

type Listed = {
  readonly deck: DeckId
  readonly name: string
  readonly edited: string
  readonly created: string
  readonly starred: boolean
  readonly doom: { readonly rev: number }
}

type ListedTrash = Listed & { readonly trashed: string }

type ListRow = {
  readonly id: string
  readonly name: string
  readonly edited: Date
  readonly created: Date
  readonly trashed: Date | null
  readonly starred: boolean
  readonly rev: number
}

type Refusal = "owner"

function deletedDoomSql(doomed: string): string {
  return `
with doomed as (
  delete from deck.doom where ${doomed} returning id, owner
),
media_queued as (
  insert into deck.original_delete (key, owner, expires)
  select media.key, doomed.owner, now() + interval '15 minutes' from deck.media join doomed on media.deck = doomed.id
  on conflict (key) do nothing
),
media_removed as (
  delete from deck.media using doomed where deck.media.deck = doomed.id
)
select id from doomed
`
}

const expireSql = deletedDoomSql("owner = $1 and trashed < now() - interval '30 days'")

const deleteSql = deletedDoomSql("owner = $1 and id = any($2::text[]) and trashed is not null")

const listSql = `
select id, name, edited, created, trashed, starred, rev
from deck.doom
where owner = $1
order by edited desc, created desc, id
`

const starSql = "update deck.doom set starred = $3 where id = $1 and owner = $2 returning starred"

const trashSql = `
update deck.doom set trashed = coalesce(trashed, now())
where id = $1 and owner = $2
returning id, trashed
`

const restoreSql = "update deck.doom set trashed = null where id = $1 and owner = $2 returning id"

const missed = { ok: false, refusal: "owner" } as const

function listed(row: ListRow): Listed {
  return {
    deck: row.id as DeckId,
    name: row.name,
    edited: row.edited.toISOString(),
    created: row.created.toISOString(),
    starred: row.starred,
    doom: { rev: row.rev },
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
  await db.query(expireSql, [email])
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

export async function starDeck(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly starred: boolean },
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly starred: boolean }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const row = (await db.query<{ starred: boolean }>(starSql, [parsed.deck, email, parsed.starred])).rows[0]
  return row === undefined ? missed : { ok: true, deck: parsed.deck, starred: row.starred }
}

export async function trashDeck(
  db: Sql,
  parsed: { readonly deck: DeckId },
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly trashed: string }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const row = (await db.query<{ trashed: Date }>(trashSql, [parsed.deck, email])).rows[0]
  return row === undefined ? missed : { ok: true, deck: parsed.deck, trashed: row.trashed.toISOString() }
}

export async function restoreDeck(
  db: Sql,
  parsed: { readonly deck: DeckId },
  email: string,
): Promise<{ readonly ok: true; readonly deck: DeckId } | { readonly ok: false; readonly refusal: Refusal }> {
  const row = (await db.query(restoreSql, [parsed.deck, email])).rows[0]
  return row === undefined ? missed : { ok: true, deck: parsed.deck }
}

export async function deleteDecks(
  db: Sql,
  parsed: { readonly decks: readonly DeckId[] },
  email: string,
): Promise<{ readonly ok: true; readonly deleted: string[] }> {
  const gone = new Set((await db.query<{ id: string }>(deleteSql, [email, parsed.decks])).rows.map((row) => row.id))
  return { ok: true, deleted: parsed.decks.filter((deck) => gone.has(deck)) }
}

export const deckListAnswers = {
  list: (db, _, email, store) => listDecks(db, email, store),
  star: starDeck,
  trash: trashDeck,
  restore: restoreDeck,
  delete: deleteDecks,
} satisfies Partial<DeckAnswers>
