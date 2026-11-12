import type { DeckId } from "@airdesign/catalog"
import { memoryTurns, type Turn, type Turns } from "@airdesign/mcp"

import type { Sql } from "./pool.js"

export type StoredTurns = Turns & {
  readonly load: (deck: DeckId) => Promise<void>
  readonly saved: () => Promise<void>
}

const saveSql = `
insert into session.agent_turn (email, deck, run_id, last_call, revision) values ($1, $2, $3, $4, $5)
on conflict (email, deck) do update
  set run_id = excluded.run_id, last_call = excluded.last_call, revision = excluded.revision
  where session.agent_turn.revision <= excluded.revision or session.agent_turn.revision = $6`

export function storedTurns(db: Sql, email: string): StoredTurns {
  const held = memoryTurns()
  const loaded = new Map<DeckId, number>()
  let saving = Promise.resolve()
  const save = async (deck: DeckId, turn: Turn): Promise<void> => {
    const params = [email, deck, turn.runId, turn.lastCall, turn.revision, loaded.get(deck) ?? null]
    await db.query(saveSql, params).catch(() => {
      process.stderr.write("api agent turn save failed\n")
    })
  }
  return {
    read: held.read,
    write: (deck, turn) => {
      held.write(deck, turn)
      saving = saving.then(() => save(deck, turn))
    },
    load: async (deck) => {
      await saving
      const found = await db.query<{ run_id: string | null; last_call: string; revision: number }>(
        "select run_id, last_call, revision from session.agent_turn where email = $1 and deck = $2",
        [email, deck],
      )
      const row = found.rows[0]
      if (row === undefined) return
      loaded.set(deck, row.revision)
      held.write(deck, { runId: row.run_id, lastCall: Number(row.last_call), revision: row.revision })
    },
    saved: () => saving,
  }
}
