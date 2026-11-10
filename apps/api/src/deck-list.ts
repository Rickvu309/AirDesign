import { readCapture, readDeckId, type DeckId } from "@airdesign/catalog"

import type { Sql } from "./pool.js"

const nameCap = 200
const deleteCap = 100

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

type Refusal = "field" | "deck" | "owner"

const expireSql = `
with gone as (
  delete from deck.saved
  where owner = $1 and trashed is not null and trashed < now() - interval '30 days'
  returning id
),
noted as (
  delete from deck.once where deck in (select id from gone)
)
select id from gone
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
with gone as (
  delete from deck.saved
  where owner = $1 and id = any($2::text[]) and trashed is not null
  returning id
),
noted as (
  delete from deck.once where deck in (select id from gone)
)
select id from gone
`

function recordOf(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined
  return raw as Record<string, unknown>
}

function onlyKeys(body: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(body).every((key) => keys.includes(key))
}

function readName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const name = raw.trim()
  const size = [...name].length
  if (size < 1 || size > nameCap) return undefined
  return name
}

function readRename(raw: unknown): { ok: true; deck: DeckId; name: string } | { ok: false; refusal: Refusal } {
  const body = recordOf(raw)
  if (body === undefined || !onlyKeys(body, ["deck", "name"]) || !Object.hasOwn(body, "deck")) {
    return { ok: false, refusal: "field" }
  }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return { ok: false, refusal: "deck" }
  const name = readName(body.name)
  if (name === undefined) return { ok: false, refusal: "field" }
  return { ok: true, deck: deck.deck, name }
}

function readDecks(raw: unknown): { ok: true; decks: DeckId[] } | { ok: false; refusal: Refusal } {
  const body = recordOf(raw)
  if (body === undefined || !onlyKeys(body, ["decks"]) || !Array.isArray(body.decks)) {
    return { ok: false, refusal: "field" }
  }
  const ids: unknown[] = body.decks
  if (ids.length < 1 || ids.length > deleteCap) return { ok: false, refusal: "field" }
  const decks: DeckId[] = []
  for (const id of ids) {
    const deck = readDeckId(id)
    if (!deck.ok) return { ok: false, refusal: "deck" }
    if (!decks.includes(deck.deck)) decks.push(deck.deck)
  }
  return { ok: true, decks }
}

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
  raw: unknown,
  email: string,
): Promise<
  | {
      readonly ok: true
      readonly account: { readonly email: string }
      readonly decks: Listed[]
      readonly trash: ListedTrash[]
    }
  | { readonly ok: false; readonly refusal: "field" }
> {
  const body = recordOf(raw)
  if (body === undefined || Object.keys(body).length > 0) return { ok: false, refusal: "field" }
  await db.query(expireSql, [email])
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
  raw: unknown,
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly name: string }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const parsed = readRename(raw)
  if (!parsed.ok) return parsed
  const result = await db.query<{ name: string }>(renameSql, [parsed.deck, email, parsed.name])
  const row = result.rows[0]
  if (row === undefined) return { ok: false, refusal: "owner" }
  return { ok: true, deck: parsed.deck, name: row.name }
}

export async function trashDeck(
  db: Sql,
  raw: unknown,
  email: string,
): Promise<
  | { readonly ok: true; readonly deck: DeckId; readonly trashed: string }
  | { readonly ok: false; readonly refusal: Refusal }
> {
  const parsed = readCapture(raw)
  if (!parsed.ok) return parsed
  const result = await db.query<{ trashed: Date }>(trashSql, [parsed.deck, email])
  const row = result.rows[0]
  if (row === undefined) return { ok: false, refusal: "owner" }
  return { ok: true, deck: parsed.deck, trashed: row.trashed.toISOString() }
}

export async function restoreDeck(
  db: Sql,
  raw: unknown,
  email: string,
): Promise<{ readonly ok: true; readonly deck: DeckId } | { readonly ok: false; readonly refusal: Refusal }> {
  const parsed = readCapture(raw)
  if (!parsed.ok) return parsed
  const result = await db.query(restoreSql, [parsed.deck, email])
  if (result.rows.length === 0) return { ok: false, refusal: "owner" }
  return { ok: true, deck: parsed.deck }
}

export async function deleteDecks(
  db: Sql,
  raw: unknown,
  email: string,
): Promise<{ readonly ok: true; readonly deleted: string[] } | { readonly ok: false; readonly refusal: Refusal }> {
  const parsed = readDecks(raw)
  if (!parsed.ok) return parsed
  const result = await db.query<{ id: string }>(deleteSql, [email, parsed.decks])
  const gone = new Set(result.rows.map((row) => row.id))
  return { ok: true, deleted: parsed.decks.filter((deck) => gone.has(deck)) }
}
