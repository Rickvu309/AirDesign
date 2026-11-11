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
       select id, original_key, original_until from deck.saved where id = $1 and owner = $2 and not original_stored for update
     ), updated as (
       update deck.saved set original_key = $3, original_bytes = $4, original_sha256 = $5,
         original_until = now() + interval '15 minutes'
       from prior where deck.saved.id = prior.id
       returning deck.saved.original_key, original_bytes, original_sha256, original_stored,
         prior.original_key as previous_key, prior.original_until as previous_until
     ), queued as (
       insert into deck.original_delete (key, owner, expires)
       select previous_key, $2, coalesce(previous_until, now()) from updated where previous_key is not null
       on conflict (key) do nothing
     )
     select * from updated`,
    [parsed.deck, email, key, parsed.bytes, parsed.sha256],
  )
  const row = result.rows[0]
  if (row?.original_key === undefined || row.original_key === null) return refused("present")
  const signed = await store.upload(row.original_key, parsed.bytes)
  await db.query(
    `with kept as (
       update deck.saved set original_until = greatest(original_until, $2::timestamptz + interval '1 minute')
       where original_key = $1 returning original_until
     )
     update deck.original_delete set expires = greatest(expires, $2::timestamptz + interval '1 minute')
     where key = $1`,
    [row.original_key, signed.expires],
  )
  return { ok: true, ...signed }
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

type Queued = { readonly key: string; readonly expired: boolean }

async function attempt(db: Sql, store: OriginalStore, row: Queued): Promise<void> {
  await db.query("update deck.original_delete set attempted = now() where key = $1", [row.key])
  try {
    await store.delete(row.key)
  } catch {
    process.stderr.write("api original delete failed: storage\n")
    return
  }
  if (row.expired) await db.query("delete from deck.original_delete where key = $1", [row.key])
}

export async function discardOriginals(db: Sql, keys: readonly string[], store?: OriginalStore): Promise<void> {
  if (store === undefined || keys.length === 0) return
  const result = await db.query<Queued>(
    "select key, expires <= now() as expired from deck.original_delete where key = any($1::text[])",
    [keys],
  )
  for (const row of result.rows) await attempt(db, store, row)
}

export async function drainOriginals(
  db: Sql,
  store: OriginalStore | undefined,
  options: { readonly owner?: string; readonly batch?: number } = {},
): Promise<void> {
  if (store === undefined) return
  try {
    const result = await db.query<Queued>(
      `select key, expires <= now() as expired from deck.original_delete
       where $1::text is null or owner = $1 order by attempted, key limit $2`,
      [options.owner ?? null, options.batch ?? 100],
    )
    for (const row of result.rows) await attempt(db, store, row)
  } catch {
    process.stderr.write("api original drain failed\n")
  }
}
