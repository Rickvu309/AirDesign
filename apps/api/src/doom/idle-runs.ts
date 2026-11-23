import type { DeckId } from "@airdesign/catalog"

import type { Sql } from "../platform/pool.js"
import { editDoom } from "./doom-deck.js"

export const runIdle = 600_000

const idleSql = `
select d.id as deck, d.owner, r.key as run, r.value ->> 'agent' as agent, (r.value ->> 'wrote')::int as wrote
from deck.doom d
cross join lateral jsonb_each(d.runs) r
left join deck.doom_edit e on e.deck = d.id and e.rev = (r.value ->> 'wrote')::int
where jsonb_path_exists(d.runs, '$.* ? (@.phase == "running")')
  and r.value ->> 'phase' = 'running'
  and r.value ->> 'agent' <> ''
  and (e.landed is null or e.landed < $1)
limit 100`

type Idle = {
  readonly deck: DeckId
  readonly owner: string
  readonly run: string
  readonly agent: string
  readonly wrote: number | null
}

export async function endIdleRuns(db: Sql, before: Date): Promise<void> {
  const idle = await db.query<Idle>(idleSql, [before])
  for (const each of idle.rows)
    await editDoom(
      db,
      {
        deck: each.deck,
        edit: {
          once: `${each.run}:idle`,
          author: { kind: "agent", id: each.agent, run: each.run },
          writes: [],
          phase: "stop",
        },
      },
      each.owner,
      (part) => part.runs.get(each.run)?.wrote === (each.wrote ?? 0),
    )
}
