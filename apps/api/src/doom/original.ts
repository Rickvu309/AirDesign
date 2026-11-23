import type { OriginalStore } from "../platform/original-store.js"
import type { Sql } from "../platform/pool.js"

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
