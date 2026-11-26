import type { DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import type { Sql } from "../platform/pool.js"

const runSql = `
select rev, edit, replaced
from deck.doom_edit where deck = $1 and edit -> 'author' ->> 'run' = $2 order by rev limit $3
`

const runEdits = 500

type RunRow = {
  readonly rev: number
  readonly edit: doom.Edit
  readonly replaced: readonly doom.Replaced[] | null
}

export async function readRunRecord(db: Sql, deck: DeckId, run: string) {
  const result = await db.query<RunRow>(runSql, [deck, run, runEdits + 1])
  if (result.rows.length > runEdits) return { ok: false, refusal: "size" } as const
  const edits: doom.Landed[] = []
  const replaced: (readonly doom.Replaced[])[] = []
  let bytes = 0
  for (const row of result.rows) {
    const edit = { ...row.edit, rev: doom.rev(row.rev) }
    const cells = row.replaced
    if (!Array.isArray(cells)) return { ok: false, refusal: "payload" } as const
    bytes += doom.bytesOf(JSON.stringify(edit)) + doom.bytesOf(JSON.stringify(cells)) + 2
    if (bytes > doom.limits.body) return { ok: false, refusal: "size" } as const
    edits.push(edit)
    replaced.push(cells)
  }
  return { ok: true, edits, replaced } as const
}
