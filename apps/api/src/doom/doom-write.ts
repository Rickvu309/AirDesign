import type { DeckId } from "@airdesign/catalog"
import { rev, type Rev } from "@airdesign/doom"
import { Pool } from "pg"

import type { Sql } from "../platform/pool.js"

export async function withDoomWrite<T>(
  db: Sql,
  deck: DeckId,
  email: string,
  write: (client: Sql) => Promise<T>,
): Promise<T> {
  const owned = db instanceof Pool ? await db.connect() : undefined
  const client = owned ?? db
  let broken: Error | undefined
  const noteBroken = (error: Error): void => {
    broken = error
  }
  owned?.on("error", noteBroken)
  try {
    await client.query("begin")
    await client.query("select id from deck.doom where id = $1 and owner = $2 and trashed is null for update", [
      deck,
      email,
    ])
    const result = await write(client)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback").catch(noteBroken)
    throw error
  } finally {
    owned?.off("error", noteBroken)
    owned?.release(broken)
  }
}

export async function runUndoRevs(db: Sql, deck: DeckId, email: string, agent: string): Promise<ReadonlySet<Rev>> {
  const { rows } = await db.query<{ rev: number }>(
    `select e.rev from deck.doom_edit e join deck.doom d on e.deck = d.id
      where d.id = $1 and d.owner = $2
        and e.edit -> 'author' ->> 'kind' = 'agent' and e.edit -> 'author' ->> 'id' = $3
        and e.edit -> 'runUndo' -> 'undone' = 'true'::jsonb`,
    [deck, email, agent],
  )
  return new Set(rows.map((row) => rev(row.rev)))
}
