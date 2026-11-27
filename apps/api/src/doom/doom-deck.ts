import { readDeckId, type DeckId, type DoomRefusal } from "@airdesign/catalog"
import { limits } from "@airdesign/doom"
import * as doom from "@airdesign/doom"

import { isUniqueViolation, type Sql } from "../platform/pool.js"
import { type Part, partOf, partSql, seedsOf } from "./doom-edit-part.js"
import { readRunRecord } from "./doom-run-record.js"
import { startAuthor, startEdit, type DeckStart } from "./doom-start.js"

const headSql = "select id, owner, rev, trashed is not null as trashed from deck.doom where id = $1"

const openWith = (onces: string) => `
select s.id, s.owner, s.rev, s.name, s.trashed is not null as trashed,
  jsonb_build_object(
    'rev', s.rev,
    'nodes', coalesce((select jsonb_object_agg(n.id, n.node) from deck.doom_node n where n.deck = s.id), '{}'::jsonb),
    'revs', coalesce((select jsonb_object_agg(n.id, n.revs) from deck.doom_node n where n.deck = s.id), '{}'::jsonb),
    'onces', ${onces},
    'runs', s.runs
  ) as fold
from deck.doom s where s.id = $1`

export const openSql = openWith(
  "coalesce((select jsonb_object_agg(e.once, e.rev) from deck.doom_edit e where e.deck = s.id), '{}'::jsonb)",
)
const undoOpenSql = openWith("'{}'::jsonb")

const writeNodesSql = `
insert into deck.doom_node (deck, id, type, parent, node, revs)
select landed.id, incoming.id, incoming.type, incoming.parent, incoming.node, incoming.revs
from landed, jsonb_to_recordset($NODES::jsonb) as incoming(id text, type text, parent text, node jsonb, revs jsonb)
on conflict (deck, id) do update
  set type = excluded.type, parent = excluded.parent, node = excluded.node, revs = excluded.revs`

const insertSql = `
with inserted as (
  insert into deck.doom (id, owner, name, rev, runs, elements, slides)
  values ($1, $2, $3, $4, $5::jsonb, $6, $7)
  on conflict (id) do nothing
  returning id, rev
),
logged as (
  insert into deck.doom_edit (deck, rev, once, edit) select id, rev, $8, $9::jsonb from inserted returning deck, rev
),
landed as (select id from inserted),
written as (${writeNodesSql.replace("$NODES", "$10")})
select pg_notify('deck', deck || ':' || rev::text) as notified from logged`

const updateSql = `
with updated as (
  update deck.doom
  set rev = $2, runs = coalesce($3::jsonb, runs), elements = $4, slides = $5, name = coalesce($6, name), edited = now()
  where id = $1 and rev = $7
  returning id, rev
),
logged as (
  insert into deck.doom_edit (deck, rev, once, edit, replaced) select id, rev, $8, $9::jsonb, $11::jsonb from updated returning deck, rev
),
landed as (select id from updated),
written as (${writeNodesSql.replace("$NODES", "$10")})
select rev, pg_notify('deck', deck || ':' || rev::text) as notified from logged`

const sinceSql = `
select s.owner, s.rev, s.trashed is not null as trashed,
  case when s.owner = $4 and s.trashed is null then coalesce(
    (select jsonb_agg(jsonb_build_object('rev', e.rev, 'edit', e.edit, 'bytes', octet_length(e.edit::text)) order by e.rev)
     from (select rev, edit from deck.doom_edit where deck = s.id and rev > $2 order by rev limit $3) e),
    '[]'::jsonb
  ) else '[]'::jsonb end as edits
from deck.doom s where s.id = $1`

const attempts = 8
const answerEdits = 100

type Stored = { readonly id: string; readonly owner: string; readonly rev: number; readonly trashed: boolean }
const refusal = (kind: Exclude<DoomRefusal, { refusal: "edit" }>["refusal"]) => ({ ok: false, refusal: kind }) as const

function editRefusal(refused: doom.Refusal) {
  return { ok: false, refusal: "edit", ...refused } as const
}

async function readStored(db: Sql, deck: DeckId): Promise<Stored | undefined> {
  return (await db.query<Stored>(headSql, [deck])).rows[0]
}

function nodeRows(fold: doom.Doom, ids: Iterable<doom.NodeId>) {
  const rows: { id: string; type: string; parent: string | null; node: doom.Node; revs: unknown }[] = []
  for (const id of ids) {
    const node = fold.nodes.get(id)
    if (node !== undefined)
      rows.push({
        id,
        type: node.type,
        parent: doom.parentOf(node)?.id ?? null,
        node,
        revs: doom.revsToJson(fold.revs.get(id)),
      })
  }
  return rows
}

function* changedNodes(part: doom.Doom, next: doom.Doom): Iterable<doom.NodeId> {
  for (const [id, node] of next.nodes) if (part.nodes.get(id) !== node) yield id
}

export async function createDoom(db: Sql, parsed: { readonly deck: DeckId }, email: string, start?: DeckStart) {
  if ((await readStored(db, parsed.deck)) === undefined) {
    const edit = { ...startEdit(start), rev: doom.rev(1) }
    const started = doom.applyEdit(doom.emptyDoom, edit)
    if (doom.isRefusal(started)) throw new Error(`the starting doom was refused: ${started.refused}`)
    const counts = doom.countsOf(started)
    await db.query(insertSql, [
      parsed.deck,
      email,
      doom.deckName(started),
      1,
      JSON.stringify(doom.runsToJson(started.runs)),
      counts.elements,
      counts.slides,
      edit.once,
      JSON.stringify(doom.readEdit({ once: edit.once, author: edit.author, writes: edit.writes }, doom.emptyDoom)),
      JSON.stringify(nodeRows(started, started.nodes.keys())),
    ])
  }
  return openDoom(db, parsed, email)
}

export async function openDoom(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly trashed?: true | undefined; readonly forUndo?: boolean },
  email: string,
) {
  const found = (
    await db.query<Stored & { readonly fold: unknown }>(parsed.forUndo ? undoOpenSql : openSql, [parsed.deck])
  ).rows[0]
  if (found === undefined) return refusal("deck")
  if (found.owner !== email) return refusal("owner")
  if (found.trashed !== (parsed.trashed === true)) return refusal("deck")
  return { ok: true, deck: parsed.deck, rev: found.rev, fold: found.fold } as const
}

export async function editDoom(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly edit: Readonly<Record<string, unknown>> },
  email: string,
  still: (part: doom.Doom) => boolean = () => true,
) {
  const { seeds, regrouped, removed: nulled } = seedsOf(parsed.edit)
  let removed = nulled
  let back: string[] = []
  const once = typeof parsed.edit.once === "string" ? parsed.edit.once : ""
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const stored = (await db.query<Part>(partSql, [parsed.deck, seeds, once, regrouped, removed, back])).rows[0]
    if (stored === undefined) return refusal("deck")
    if (stored.owner !== email) return refusal("owner")
    if (stored.trashed) return refusal("deck")
    if (stored.landed !== null) return { ok: true, deck: parsed.deck, rev: stored.landed } as const
    const part = partOf(stored)
    if (part === undefined) return refusal("payload")
    if (!still(part)) return refusal("stale")
    const read = doom.readEdit(parsed.edit, part)
    if (doom.isRefusal(read)) return editRefusal(read)
    const landed = { ...read, rev: doom.rev(part.rev + 1) }
    const landing = doom.landEdit(part, landed, {
      accepting: true,
      counts: () => ({ elements: stored.elements, slides: stored.slides }),
      deck: () => stored.has_deck,
    })
    if (doom.isRefusal(landing)) return editRefusal(landing)
    if (landing.doom === part) return { ok: true, deck: parsed.deck, rev: part.rev } as const
    const unread = [...doom.leavingRoots(part.nodes, landing.doom.nodes, landed.writes)].filter(
      (root) => !removed.includes(root),
    )
    const unreadBack = [...doom.returningRoots(part.nodes, landing.doom.nodes, landed.writes)].filter(
      (root) => !back.includes(root),
    )
    if (unread.length > 0 || unreadBack.length > 0) {
      removed = [...removed, ...unread]
      back = [...back, ...unreadBack]
      continue
    }
    const next = landing.doom
    const touched = nodeRows(next, changedNodes(part, next))
    const deck = touched.find((row) => row.type === "deck")
    const runsMoved =
      next.runs.size !== part.runs.size || [...next.runs].some(([name, run]) => part.runs.get(name) !== run)
    const run = read.author.kind === "agent" ? read.author.run : undefined
    const replaced = run === undefined ? null : JSON.stringify(doom.replacedBy(part, landed))
    try {
      const wrote = await db.query(updateSql, [
        parsed.deck,
        landed.rev,
        runsMoved ? JSON.stringify(doom.runsToJson(next.runs)) : null,
        stored.elements + landing.delta.elements,
        stored.slides + landing.delta.slides,
        deck === undefined ? null : ((deck.node as { name?: string }).name ?? ""),
        part.rev,
        landed.once,
        JSON.stringify(read),
        JSON.stringify(touched),
        replaced,
      ])
      if (wrote.rows.length > 0) return { ok: true, deck: parsed.deck, rev: landed.rev } as const
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  }
  return refusal("stale")
}

type Caught = Omit<Stored, "id"> & {
  readonly edits: readonly { readonly rev: number; readonly edit: object; readonly bytes: number }[]
}

export async function sinceDoom(db: Sql, parsed: { readonly deck: DeckId; readonly rev: number }, email: string) {
  const stored = (await db.query<Caught>(sinceSql, [parsed.deck, parsed.rev, answerEdits, email])).rows[0]
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (stored.trashed) return refusal("deck")
  if (parsed.rev > stored.rev) return refusal("cursor")
  const edits: unknown[] = []
  let bytes = 0
  for (const row of stored.edits) {
    bytes += row.bytes
    if (edits.length > 0 && bytes > limits.body) break
    edits.push({ ...row.edit, rev: row.rev })
  }
  return { ok: true, deck: parsed.deck, rev: stored.rev, edits } as const
}

export async function runDoom(db: Sql, parsed: { readonly deck: DeckId; readonly run: string }, email: string) {
  const stored = await readStored(db, parsed.deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (stored.trashed) return refusal("deck")
  const result = await readRunRecord(db, parsed.deck, parsed.run)
  return result.ok ? { ...result, deck: parsed.deck, rev: stored.rev } : result
}

const runPositionsSql = `
with recursive positions as materialized (
  select distinct on (write ->> 'node', write ->> 'prop')
    write ->> 'node' as node, write ->> 'prop' as prop, write -> 'value' as value
  from deck.doom_edit cross join lateral jsonb_array_elements(edit -> 'writes') with ordinality as w(write, at)
  where deck = $1 and rev <= $2 and write ->> 'prop' in ('box', 'parent')
  order by write ->> 'node', write ->> 'prop', rev desc, at desc
), ancestors(node) as (
  select unnest($3::text[])
  union
  select value ->> 'id' from positions join ancestors using (node)
  where prop = 'parent' and value ->> 'id' is not null
)
select node, prop, value from positions join ancestors using (node)
`

export async function runPositions(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly rev: number; readonly nodes: readonly doom.NodeId[] },
  email: string,
): Promise<doom.LayerPositions | undefined> {
  const stored = await readStored(db, parsed.deck)
  if (stored === undefined || stored.owner !== email || stored.trashed) return undefined
  const { rows } = await db.query<{ node: string; prop: "box" | "parent"; value: unknown }>(runPositionsSql, [
    parsed.deck,
    parsed.rev,
    parsed.nodes,
  ])
  const parents = new Map<doom.NodeId, doom.NodeId>()
  const rotations = new Map<doom.NodeId, number>()
  for (const { node, prop, value } of rows) {
    const id = doom.readNodeId(node)
    if (id === undefined) return undefined
    if (prop === "parent") {
      const parent = doom.props.parent.read(value)
      if (doom.isRefusal(parent)) return undefined
      if (parent !== null) parents.set(id, parent.id)
    } else if (value !== null) {
      const box = doom.props.box.read(value)
      if (doom.isRefusal(box)) return undefined
      rotations.set(id, box.rotation)
    }
  }
  return { parent: (node) => parents.get(node), rotation: (node) => rotations.get(node) ?? 0 }
}

export async function doomRev(db: Sql, deck: DeckId, email: string) {
  const stored = await readStored(db, deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (stored.trashed) return refusal("deck")
  return { ok: true, rev: stored.rev } as const
}

const listSql = `
select id, name, rev from deck.doom
where owner = $1 and trashed is null
  and ($2::text is null or (edited, id) < (select edited, id from deck.doom where id = $2 and owner = $1))
order by edited desc, id desc
limit $3`

export async function listDoom(
  db: Sql,
  email: string,
  after: string | undefined,
  limit: number,
): Promise<readonly { readonly id: string; readonly name: string; readonly rev: number }[]> {
  return (await db.query<{ id: string; name: string; rev: number }>(listSql, [email, after ?? null, limit])).rows
}

const onceRunSql = `
select edit -> 'author' ->> 'run' as run from deck.doom_edit
join deck.doom on deck.doom.id = deck.doom_edit.deck
where deck.doom.owner = $1 and deck.doom_edit.deck = $2 and deck.doom_edit.once = $3`

export async function spendOnce(db: Sql, email: string, deck: string, once: string): Promise<string | undefined> {
  const named = readDeckId(deck)
  if (named.ok) await editDoom(db, { deck: named.deck, edit: { once, author: startAuthor, writes: [] } }, email)
  return (await db.query<{ run: string | null }>(onceRunSql, [email, deck, once])).rows[0]?.run ?? undefined
}

export async function lastAgentRead(db: Sql, deck: DeckId, agent: string) {
  const { rows } = await db.query<{ rev: number }>(
    "select rev from deck.doom_agent_read where deck = $1 and agent = $2",
    [deck, agent],
  )
  return rows[0] === undefined ? undefined : doom.rev(rows[0].rev)
}

export async function rememberAgentRead(db: Sql, deck: DeckId, agent: string, rev: doom.Rev): Promise<void> {
  await db.query(
    `insert into deck.doom_agent_read as seen (deck, agent, rev) values ($1, $2, $3)
    on conflict (deck, agent) do update set rev = excluded.rev where seen.rev < excluded.rev`,
    [deck, agent, rev],
  )
}

export async function personRevs(db: Sql, deck: DeckId, revs: readonly doom.Rev[]) {
  const { rows } = await db.query<{ rev: number }>(
    "select rev from deck.doom_edit where deck = $1 and rev = any($2::integer[]) and edit #>> '{author,kind}' = 'person'",
    [deck, revs],
  )
  return new Set(rows.map(({ rev }) => doom.rev(rev)))
}
