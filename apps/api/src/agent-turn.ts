import type { DeckId } from "@airdesign/catalog"
import { memoryTurns, type Turn, type Turns } from "@airdesign/mcp"

import type { Sql } from "./pool.js"

export type StoredTurns = Turns & {
  readonly load: (deck: DeckId) => Promise<void>
  readonly saved: () => Promise<void>
}

const saveSql = `
insert into session.agent_turn (email, deck, agent, run_id, last_call, revision) values ($1, $2, $3, $4, $5, $6)
on conflict (email, deck, agent) do update
  set run_id = excluded.run_id, last_call = excluded.last_call, revision = excluded.revision
  where session.agent_turn.revision <= excluded.revision or session.agent_turn.revision = $7`

type Row = { agent: string; run_id: string | null; last_call: string; revision: number }

function turnOf(row: Row): Turn {
  return { runId: row.run_id, lastCall: Number(row.last_call), revision: row.revision }
}

export function storedTurns(db: Sql, email: string, agent: string): StoredTurns {
  const held = memoryTurns(agent)
  const loaded = new Map<DeckId, number>()
  const others = new Map<DeckId, readonly Turn[]>()
  let saving = Promise.resolve()
  const save = async (deck: DeckId, turn: Turn): Promise<void> => {
    const params = [email, deck, agent, turn.runId, turn.lastCall, turn.revision, loaded.get(deck) ?? null]
    await db.query(saveSql, params).catch(() => {
      process.stderr.write("api agent turn save failed\n")
    })
  }
  return {
    ...held,
    write: (deck, turn) => {
      held.write(deck, turn)
      saving = saving.then(() => save(deck, turn))
    },
    others: (deck) => others.get(deck) ?? [],
    load: async (deck) => {
      await saving
      const found = await db.query<Row>(
        "select agent, run_id, last_call, revision from session.agent_turn where email = $1 and deck = $2",
        [email, deck],
      )
      others.set(deck, found.rows.filter((row) => row.agent !== agent).map(turnOf))
      const row = found.rows.find((each) => each.agent === agent)
      if (row === undefined) return
      loaded.set(deck, row.revision)
      held.write(deck, turnOf(row))
    },
    saved: () => saving,
  }
}
