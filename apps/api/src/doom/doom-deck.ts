import { readDeckId, type DeckId, type DoomRefusal } from "@airdesign/catalog"
import { limits } from "@airdesign/doom"
import * as doom from "@airdesign/doom"

import { isUniqueViolation, type Sql } from "../platform/pool.js"
import { startAuthor, startEdit } from "./doom-start.js"

const headSql = "select id, owner, rev, trashed is not null as trashed from deck.doom where id = $1"

export const openSql = `
select s.id, s.owner, s.rev, s.name, s.trashed is not null as trashed,
  jsonb_build_object(
    'rev', s.rev,
    'nodes', coalesce((select jsonb_object_agg(n.id, n.node) from deck.doom_node n where n.deck = s.id), '{}'::jsonb),
    'revs', coalesce((select jsonb_object_agg(n.id, n.revs) from deck.doom_node n where n.deck = s.id), '{}'::jsonb),
    'onces', coalesce((select jsonb_object_agg(e.once, e.rev) from deck.doom_edit e where e.deck = s.id), '{}'::jsonb),
    'runs', s.runs
  ) as fold
from deck.doom s where s.id = $1`

const partSql = `
with recursive chain(id, type, parent) as (
  select n.id, n.type, n.parent from deck.doom_node n where n.deck = $1 and n.id = any($2::text[])
  union
  select up.id, up.type, up.parent from deck.doom_node up join chain on up.id = chain.parent where up.deck = $1
),
wanted as (
  select id from chain
  union
  select n.id from deck.doom_node n join chain on n.parent = chain.id
  where n.deck = $1 and chain.id = any($4::text[]) and chain.type = 'slideRow' and n.type = 'slide'
)
select s.owner, s.rev, s.runs, s.elements, s.slides, s.trashed is not null as trashed,
  exists (select 1 from deck.doom_node d where d.deck = s.id and d.type = 'deck') as has_deck,
  (select e.rev from deck.doom_edit e where e.deck = s.id and e.once = $3) as landed,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', n.id, 'node', n.node, 'revs', n.revs))
     from deck.doom_node n join wanted on wanted.id = n.id where n.deck = s.id),
    '[]'::jsonb
  ) as nodes
from deck.doom s where s.id = $1`

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

const runSql =
  "select rev, edit, replaced, octet_length(edit::text) + coalesce(octet_length(replaced::text), 0) as bytes from deck.doom_edit where deck = $1 and edit -> 'author' ->> 'run' = $2 order by rev limit $3"

const runEdits = 500

const editsSql =
  "select rev, edit, octet_length(edit::text) as bytes from deck.doom_edit where deck = $1 and rev > $2 order by rev limit $3"

const attempts = 8
const answerEdits = 100

type Stored = { readonly id: string; readonly owner: string; readonly rev: number; readonly trashed: boolean }
type Part = {
  readonly owner: string
  readonly trashed: boolean
  readonly rev: number
  readonly runs: unknown
  readonly elements: number
  readonly slides: number
  readonly has_deck: boolean
  readonly landed: number | null
  readonly nodes: readonly { readonly id: string; readonly node: unknown; readonly revs: unknown }[]
}

const refusal = (kind: Exclude<DoomRefusal, { refusal: "edit" }>["refusal"]) => ({ ok: false, refusal: kind }) as const

function editRefusal(refused: doom.Refusal) {
  return { ok: false, refusal: "edit", ...refused } as const
}

async function readStored(db: Sql, deck: DeckId): Promise<Stored | undefined> {
  return (await db.query<Stored>(headSql, [deck])).rows[0]
}

const parentOf = (node: doom.Node | undefined) => (node as { parent?: { id: doom.NodeId } | null } | undefined)?.parent

function nodeRows(fold: doom.Doom, ids: Iterable<doom.NodeId>) {
  const rows: { id: string; type: string; parent: string | null; node: doom.Node; revs: unknown }[] = []
  for (const id of ids) {
    const node = fold.nodes.get(id)
    if (node !== undefined)
      rows.push({
        id,
        type: node.type,
        parent: parentOf(node)?.id ?? null,
        node,
        revs: doom.revsToJson(fold.revs.get(id)),
      })
  }
  return rows
}

function seedsOf(edit: Readonly<Record<string, unknown>>): { readonly seeds: string[]; readonly regrouped: string[] } {
  const seeds = new Set<string>()
  const regrouped = new Set<string>()
  if (!Array.isArray(edit.writes)) return { seeds: [], regrouped: [] }
  for (const each of edit.writes as unknown[]) {
    if (typeof each !== "object" || each === null) continue
    const { node, prop, value } = each as { node?: unknown; prop?: unknown; value?: unknown }
    if (typeof node === "string") seeds.add(node)
    if (typeof node === "string" && (prop === "parent" || prop === "hidden")) regrouped.add(node)
    const parent = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : undefined
    if (prop === "parent" && typeof parent === "string") seeds.add(parent)
  }
  return { seeds: [...seeds], regrouped: [...regrouped] }
}

function partOf(part: Part, once: string): doom.Doom | undefined {
  const nodes = new Map<doom.NodeId, doom.Node>()
  const revs = new Map<doom.NodeId, ReadonlyMap<doom.WriteKey, doom.Rev>>()
  const children = new Map<doom.NodeId, doom.NodeId[]>()
  for (const found of part.nodes) {
    const stored = doom.readStoredNode(found.id, found.node, found.revs)
    if (stored === undefined) return undefined
    nodes.set(stored.node.id, stored.node)
    revs.set(stored.node.id, stored.revs)
    if (stored.node.type === "slideRow") children.set(stored.node.id, [])
  }
  for (const node of nodes.values()) {
    const parent = parentOf(node)
    if (node.type === "slide" && parent != null) children.get(parent.id)?.push(node.id)
  }
  const runs = doom.readRuns(part.runs)
  if (runs === undefined) return undefined
  const onces = new Map<string, doom.Rev>(part.landed === null ? [] : [[once, doom.rev(part.landed)]])
  return { nodes, revs, children, rev: doom.rev(part.rev), onces, runs }
}

export async function createDoom(db: Sql, parsed: { readonly deck: DeckId }, email: string) {
  if ((await readStored(db, parsed.deck)) === undefined) {
    const edit = { ...startEdit(), rev: doom.rev(1) }
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
  parsed: { readonly deck: DeckId; readonly trashed?: true | undefined },
  email: string,
) {
  const found = (await db.query<Stored & { readonly fold: unknown }>(openSql, [parsed.deck])).rows[0]
  if (found === undefined) return refusal("deck")
  if (found.owner !== email) return refusal("owner")
  if (found.trashed !== (parsed.trashed === true)) return refusal("deck")
  return { ok: true, deck: parsed.deck, rev: found.rev, fold: found.fold } as const
}

export async function editDoom(
  db: Sql,
  parsed: { readonly deck: DeckId; readonly edit: Readonly<Record<string, unknown>> },
  email: string,
) {
  const { seeds, regrouped } = seedsOf(parsed.edit)
  const once = typeof parsed.edit.once === "string" ? parsed.edit.once : ""
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const stored = (await db.query<Part>(partSql, [parsed.deck, seeds, once, regrouped])).rows[0]
    if (stored === undefined) return refusal("deck")
    if (stored.owner !== email) return refusal("owner")
    if (stored.trashed) return refusal("deck")
    const part = partOf(stored, once)
    if (part === undefined) return refusal("payload")
    const read = doom.readEdit(parsed.edit, part)
    if (doom.isRefusal(read)) return editRefusal(read)
    const landed = { ...read, rev: doom.rev(part.rev + 1) }
    const landing = doom.landEdit(part, landed, {
      counts: () => ({ elements: stored.elements, slides: stored.slides }),
      deck: () => stored.has_deck,
    })
    if (doom.isRefusal(landing)) return editRefusal(landing)
    if (landing.doom === part)
      return { ok: true, deck: parsed.deck, rev: part.onces.get(read.once) ?? part.rev } as const
    const next = landing.doom
    const touched = nodeRows(next, new Set(landed.writes.map((each) => each.node)))
    const deck = touched.find((row) => row.type === "deck")
    const runsMoved =
      next.runs.size !== part.runs.size || [...next.runs].some(([name, run]) => part.runs.get(name) !== run)
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
        read.author.kind === "agent" && read.author.run !== undefined
          ? JSON.stringify(doom.replacedBy(part, landed))
          : null,
      ])
      if (wrote.rows.length > 0) return { ok: true, deck: parsed.deck, rev: landed.rev } as const
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  }
  return refusal("stale")
}

export async function sinceDoom(db: Sql, parsed: { readonly deck: DeckId; readonly rev: number }, email: string) {
  const stored = await readStored(db, parsed.deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (stored.trashed) return refusal("deck")
  if (parsed.rev > stored.rev) return refusal("cursor")
  const rows = await db.query<{ rev: number; edit: unknown; bytes: number }>(editsSql, [
    parsed.deck,
    parsed.rev,
    answerEdits,
  ])
  const edits: unknown[] = []
  let bytes = 0
  for (const row of rows.rows) {
    bytes += row.bytes
    if (edits.length > 0 && bytes > limits.body) break
    edits.push({ ...(row.edit as object), rev: row.rev })
  }
  const head = await readStored(db, parsed.deck)
  return { ok: true, deck: parsed.deck, rev: Math.max(head?.rev ?? 0, rows.rows.at(-1)?.rev ?? 0), edits } as const
}

export async function runDoom(db: Sql, parsed: { readonly deck: DeckId; readonly run: string }, email: string) {
  const stored = await readStored(db, parsed.deck)
  if (stored === undefined) return refusal("deck")
  if (stored.owner !== email) return refusal("owner")
  if (stored.trashed) return refusal("deck")
  const rows = await db.query<{ rev: number; edit: object; replaced: unknown; bytes: number }>(runSql, [
    parsed.deck,
    parsed.run,
    runEdits + 1,
  ])
  if (rows.rows.length > runEdits) return refusal("size")
  const edits: unknown[] = []
  const replaced: unknown[] = []
  let bytes = 0
  for (const row of rows.rows) {
    if (!Array.isArray(row.replaced)) return refusal("payload")
    bytes += row.bytes
    edits.push({ ...row.edit, rev: row.rev })
    replaced.push(row.replaced)
  }
  if (bytes > limits.body) return refusal("size")
  return { ok: true, deck: parsed.deck, rev: stored.rev, edits, replaced } as const
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
