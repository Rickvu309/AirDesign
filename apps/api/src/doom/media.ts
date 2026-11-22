import type { DeckAnswers } from "../platform/deck-answer.js"
import { createHash } from "node:crypto"
import type { DeckId, WireRefusal } from "@airdesign/catalog"
import { limits } from "@airdesign/document"

import type { OriginalStore } from "../platform/original-store.js"
import type { Sql } from "../platform/pool.js"

type MediaRow = { readonly key: string; readonly bytes: number }

const refused = (refusal: WireRefusal) => ({ ok: false as const, refusal })

const ownedSql = `
select deleted is not null as deleted from deck.saved where id = $1 and owner = $2
union all
select false from deck.doom where id = $1 and owner = $2
limit 1`

const insertSql = `
with saved_live as (
  select id from deck.saved where id = $1 and owner = $2 and deleted is null for share
), doom_live as (
  select id from deck.doom where id = $1 and owner = $2 for share
), live as (
  select id from saved_live union all select id from doom_live limit 1
), held as (
  select coalesce(sum(bytes), 0) as total from deck.media where deck = $1
)
insert into deck.media (key, deck, sha256, bytes)
select $3::text, live.id, $4::text, $5::integer from live, held where held.total + $5::integer < $6::bigint
on conflict (deck, sha256) do nothing
returning key, bytes`

const heldSql = "select key, bytes from deck.media where deck = $1 and sha256 = $2"

async function unowned(db: Sql, deck: DeckId, email: string) {
  const result = await db.query<{ deleted: boolean }>(ownedSql, [deck, email])
  const row = result.rows[0]
  if (row === undefined) return refused("owner")
  return row.deleted ? refused("deleted") : undefined
}

async function held(db: Sql, deck: DeckId, sha256: string): Promise<MediaRow | undefined> {
  return (await db.query<MediaRow>(heldSql, [deck, sha256])).rows[0]
}

type Placed = { readonly deck: DeckId; readonly bytes: number; readonly sha256: string }

async function placedMedia(
  db: Sql,
  parsed: Placed,
  email: string,
): Promise<{ readonly ok: true; readonly row: MediaRow } | ReturnType<typeof refused>> {
  const missing = await unowned(db, parsed.deck, email)
  if (missing !== undefined) return missing
  if (parsed.bytes < 1 || parsed.bytes >= limits.media) return refused("limit")
  const account = createHash("sha256").update(email).digest("hex")
  const key = `media/${account}/${parsed.deck}/${parsed.sha256}`
  const inserted = await db.query<MediaRow>(insertSql, [
    parsed.deck,
    email,
    key,
    parsed.sha256,
    parsed.bytes,
    limits.bytes,
  ])
  const row = inserted.rows[0] ?? (await held(db, parsed.deck, parsed.sha256))
  if (row === undefined) return (await unowned(db, parsed.deck, email)) ?? refused("limit")
  return row.bytes === parsed.bytes ? { ok: true, row } : refused("present")
}

export async function uploadMedia(
  db: Sql,
  parsed: Placed,
  email: string,
  store: OriginalStore | undefined,
): Promise<unknown> {
  if (store === undefined) return (await unowned(db, parsed.deck, email)) ?? refused("storage")
  const placed = await placedMedia(db, parsed, email)
  if (!placed.ok) return placed
  return { ok: true, ...(await store.upload(placed.row.key, placed.row.bytes)) }
}

export async function keepMedia(
  db: Sql,
  deck: DeckId,
  bytes: Uint8Array,
  email: string,
  store: OriginalStore | undefined,
): Promise<{ readonly ok: true; readonly sha256: string } | ReturnType<typeof refused>> {
  if (store === undefined) return refused("storage")
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const placed = await placedMedia(db, { deck, bytes: bytes.byteLength, sha256 }, email)
  if (!placed.ok) return placed
  if ((await store.size(placed.row.key)) !== placed.row.bytes) await store.write(placed.row.key, bytes)
  return { ok: true, sha256 }
}

export async function storedMedia(
  db: Sql,
  deck: DeckId,
  sha256: string,
  store: OriginalStore | undefined,
): Promise<Uint8Array | undefined> {
  const row = await held(db, deck, sha256)
  return row === undefined || store === undefined ? undefined : store.read(row.key)
}

export async function downloadMedia(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly sha256: string },
  email: string,
  store: OriginalStore | undefined,
): Promise<unknown> {
  const missing = await unowned(db, parsed.deck, email)
  if (missing !== undefined) return missing
  if (store === undefined) return refused("storage")
  const row = await held(db, parsed.deck, parsed.sha256)
  if (row === undefined || (await store.size(row.key)) !== row.bytes) return refused("missing")
  return { ok: true, ...(await store.download(row.key)), bytes: row.bytes, sha256: parsed.sha256 }
}

export const mediaAnswers = {
  mediaUpload: uploadMedia,
  media: downloadMedia,
} satisfies Partial<DeckAnswers>
