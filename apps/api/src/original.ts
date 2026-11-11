import { createHash } from "node:crypto"
import type { DeckId } from "@airdesign/catalog"
import { limits } from "@airdesign/document"

import type { OriginalStore } from "./original-store.js"
import type { Sql } from "./pool.js"

type OriginalRow = {
  readonly original_key: string | null
  readonly original_bytes: number | null
  readonly original_sha256: string | null
  readonly original_stored: boolean
}

type OriginalRequest = { readonly deck: DeckId; readonly bytes: number; readonly sha256: string }

const refused = (refusal: string) => ({ ok: false as const, refusal })

async function owned(db: Sql, deck: DeckId, email: string): Promise<OriginalRow | undefined> {
  const result = await db.query<OriginalRow>(
    "select original_key, original_bytes, original_sha256, original_stored from deck.saved where id = $1 and owner = $2",
    [deck, email],
  )
  return result.rows[0]
}

export async function uploadOriginal(
  db: Sql,
  parsed: OriginalRequest,
  email: string,
  store: OriginalStore | undefined,
  mint: () => string,
): Promise<unknown> {
  if ((await owned(db, parsed.deck, email)) === undefined) return refused("owner")
  if (store === undefined) return refused("storage")
  if (parsed.bytes >= limits.bytes) return refused("limit")
  const account = createHash("sha256").update(email).digest("hex")
  const key = `originals/${account}/${parsed.deck}/${mint()}`
  const result = await db.query<OriginalRow>(
    `with prior as (
       select id, original_key from deck.saved where id = $1 and owner = $2 and not original_stored for update
     ), updated as (
       update deck.saved set original_key = $3, original_bytes = $4, original_sha256 = $5
       from prior where deck.saved.id = prior.id
       returning deck.saved.original_key, original_bytes, original_sha256, original_stored,
         prior.original_key as previous_key
     ), queued as (
       insert into deck.original_delete (key, owner)
       select previous_key, $2 from updated where previous_key is not null
       on conflict (key) do nothing
     )
     select * from updated`,
    [parsed.deck, email, key, parsed.bytes, parsed.sha256],
  )
  const row = result.rows[0]
  if (row?.original_key === undefined || row.original_key === null) return refused("present")
  return { ok: true, ...(await store.upload(row.original_key, parsed.bytes)) }
}

export async function finishOriginal(db: Sql, deck: DeckId, email: string, store?: OriginalStore): Promise<unknown> {
  const row = await owned(db, deck, email)
  if (row === undefined) return refused("owner")
  if (store === undefined) return refused("storage")
  if (row.original_key === null || (await store.size(row.original_key)) !== row.original_bytes)
    return refused("missing")
  const result = await db.query(
    "update deck.saved set original_stored = true where id = $1 and owner = $2 and original_key = $3 returning id",
    [deck, email, row.original_key],
  )
  return result.rows.length === 0 ? refused("owner") : { ok: true }
}

export async function downloadOriginal(db: Sql, deck: DeckId, email: string, store?: OriginalStore): Promise<unknown> {
  const row = await owned(db, deck, email)
  if (row === undefined) return refused("owner")
  if (store === undefined) return refused("storage")
  if (!row.original_stored || row.original_key === null) return refused("missing")
  return {
    ok: true,
    ...(await store.download(row.original_key)),
    bytes: row.original_bytes,
    sha256: row.original_sha256,
  }
}

export async function removeOriginals(db: Sql, email: string, store?: OriginalStore): Promise<void> {
  if (store === undefined) return
  const result = await db.query<{ key: string; expired: boolean }>(
    "select key, expires <= now() as expired from deck.original_delete where owner = $1 order by expires limit 100",
    [email],
  )
  for (const row of result.rows) {
    try {
      await store.delete(row.key)
      if (row.expired) await db.query("delete from deck.original_delete where key = $1", [row.key])
    } catch {
      process.stderr.write("api original delete failed: storage\n")
    }
  }
}
