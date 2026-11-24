import { deflateRawSync, inflateRawSync } from "node:zlib"
import type { DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import type { Sql } from "../platform/pool.js"

const runSql = `
with recursive edits as materialized (
  select rev, edit, replaced
  from deck.doom_edit where deck = $1 and edit -> 'author' ->> 'run' = $2 order by rev limit $3
), instance_cells as (
  select rev, cell ->> 'node' as node, cell ->> 'compact' = 'true' as compact
  from edits cross join lateral jsonb_array_elements(
    case jsonb_typeof(replaced) when 'object' then replaced -> 'cells' when 'array' then replaced end
  ) cell
  where cell ->> 'key' = 'instance'
), mixed as (
  select node from instance_cells group by node
  having bool_or(compact is true) and bool_or(compact is not true)
), expanded as (
  select distinct rev from instance_cells join mixed using (node) where compact
), sources(rev) as (
  select rev from expanded
  union
  select writer::int from sources join edits using (rev)
  cross join lateral jsonb_array_elements_text(edits.replaced -> 'writers') writer
)
select edits.rev,
  case when jsonb_typeof(replaced) = 'object' then jsonb_set(edit, '{writes}', replaced -> 'writes') else edit end as edit,
  case when jsonb_typeof(replaced) = 'object' then replaced -> 'cells' else replaced end as replaced,
  case when sources.rev is not null then edit end as original,
  case when sources.rev is not null then replaced ->> 'before' end as before,
  expanded.rev is not null as expand
from edits left join expanded using (rev) left join sources using (rev) order by edits.rev
`

const runEdits = 500

const priorWritersSql = `
select rev from deck.doom_edit
where deck = $1 and rev = any($2::int[]) and edit -> 'author' ->> 'run' = $3 and replaced ? 'before'
`

type BeforeCell = doom.Replaced & { readonly fromWriter?: true }

export async function runRecord(db: Sql, deck: DeckId, run: string, before: doom.Doom, edit: doom.Landed) {
  const { writes, replaced } = doom.undoSourceOf(before, edit)
  const compact = new Set(replaced.filter((cell) => cell.compact).map((cell) => cell.node))
  if (compact.size === 0) return replaced

  const full = doom.replacedBy(before, edit)
  const revisions = full.flatMap(({ node, key, rev }) =>
    key === "instance" && compact.has(node) && rev !== null ? [rev] : [],
  )
  const prior = new Set(
    (await db.query<{ readonly rev: number }>(priorWritersSql, [deck, revisions, run])).rows.map(({ rev }) => rev),
  )
  const cells = full.map<BeforeCell>((cell) =>
    cell.key === "instance" && cell.rev !== null && compact.has(cell.node) && prior.has(cell.rev)
      ? { ...cell, value: null, fromWriter: true }
      : cell,
  )
  return {
    writes,
    cells: replaced,
    ...(prior.size === 0 ? {} : { writers: [...prior] }),
    before: deflateRawSync(JSON.stringify(cells), { level: 1 }).toString("base64"),
  }
}

type RunRow = {
  readonly rev: number
  readonly edit: doom.Edit
  readonly replaced: readonly doom.Replaced[] | null
  readonly original: doom.Edit | null
  readonly before: string | null
  readonly expand: boolean
}

function fullCells(
  row: RunRow,
  edit: doom.Landed,
  after: Map<number, ReadonlyMap<doom.NodeId, unknown>>,
): readonly doom.Replaced[] | undefined {
  if (row.before === null) return undefined
  const saved: readonly BeforeCell[] = JSON.parse(inflateRawSync(Buffer.from(row.before, "base64")).toString())
  const cells: doom.Replaced[] = []
  const instances = new Map<doom.NodeId, unknown>()
  for (const cell of saved) {
    if (cell.key !== "instance") {
      cells.push(cell)
      continue
    }
    const { fromWriter, ...rest } = cell
    const value = fromWriter && cell.rev !== null ? after.get(cell.rev)?.get(cell.node) : cell.value
    if (value === undefined) return undefined
    const written = doom.instanceAfterEdit(cell.node, value, edit)
    if (written !== undefined) instances.set(cell.node, written)
    cells.push({ ...rest, value })
  }
  after.set(row.rev, instances)
  return cells
}

export async function readRunRecord(db: Sql, deck: DeckId, run: string) {
  const result = await db.query<RunRow>(runSql, [deck, run, runEdits + 1])
  if (result.rows.length > runEdits) return { ok: false, refusal: "size" } as const
  const edits: doom.Landed[] = []
  const replaced: (readonly doom.Replaced[])[] = []
  const after = new Map<number, ReadonlyMap<doom.NodeId, unknown>>()
  let bytes = 0
  for (const row of result.rows) {
    const rev = doom.rev(row.rev)
    const original = row.original === null ? undefined : { ...row.original, rev }
    const full = original === undefined ? undefined : fullCells(row, original, after)
    const edit = row.expand && original !== undefined ? original : { ...row.edit, rev }
    const cells = row.expand ? full : row.replaced
    if (!Array.isArray(cells)) return { ok: false, refusal: "payload" } as const
    bytes += doom.bytesOf(JSON.stringify(edit)) + doom.bytesOf(JSON.stringify(cells)) + 2
    if (bytes > doom.limits.body) return { ok: false, refusal: "size" } as const
    edits.push(edit)
    replaced.push(cells)
  }
  return { ok: true, edits, replaced } as const
}
