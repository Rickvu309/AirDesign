import * as doom from "@airdesign/doom"

export const partSql = `
with recursive gone(id) as (
  select n.id from deck.doom_node n where n.deck = $1 and n.id = any($5::text[])
  union
  select n.id from gone
  cross join lateral (select n.id from deck.doom_node n where n.deck = $1 and n.parent = gone.id offset 0) n
),
back(id, node) as (
  select n.id, n.node from deck.doom_node n where n.deck = $1 and n.id = any($6::text[])
  union
  select n.id, n.node from back
  cross join lateral (select n.id, n.node from deck.doom_node n where n.deck = $1 and n.parent = back.id offset 0) n
),
changed_components as (
  select id from deck.doom_node where deck = $1 and type = 'component' and id = any($2::text[])
),
seeded(ids) as (
  select array(
    select unnest($2::text[])
    union
    select n.id from deck.doom_node n
    where exists (select 1 from changed_components)
      and n.deck = $1 and n.type = 'frame'
      and n.node #>> '{instance,component,node}' = any(array(select id from changed_components))
    union
    select id from back
    where node #>> '{geometry,start,node}' is not null or node #>> '{geometry,end,node}' is not null
    union
    select n.id from deck.doom_node n
    where n.deck = $1 and n.node #>> '{geometry,start,node}' = any(array(select id from gone))
    union
    select n.id from deck.doom_node n
    where n.deck = $1 and n.node #>> '{geometry,end,node}' = any(array(select id from gone))
  )
),
named(ids) as (
  select array(
    select unnest(ids) from seeded
    union
    select e.id from deck.doom_node n
    cross join lateral (values (n.node #>> '{geometry,start,node}'), (n.node #>> '{geometry,end,node}')) as e(id)
    where n.deck = $1 and n.id = any((select ids from seeded)::text[]) and e.id is not null
  )
),
chain(id, type, parent) as (
  select n.id, n.type, n.parent from deck.doom_node n where n.deck = $1 and n.id = any((select ids from named)::text[])
  union
  select up.id, up.type, up.parent from chain
  cross join lateral (select up.id, up.type, up.parent from deck.doom_node up where up.deck = $1 and up.id = chain.parent offset 0) up
),
generated as (
  select n.node #>> '{instance,generated}' as id
  from chain join deck.doom_node n on n.deck = $1 and n.id = chain.id
  where n.node ? 'instance'
  union
  select unnest($7::text[])
),
sources as (
  select n.node #>> '{instance,component,node}' as id
  from chain join deck.doom_node n on n.deck = $1 and n.id = chain.id
  where n.node #>> '{instance,component,node}' is not null
  union
  select node #>> '{instance,component,node}' from back where node #>> '{instance,component,node}' is not null
  union
  select unnest($8::text[])
),
components as (
  select id, parent from deck.doom_node
  where deck = $1 and type = 'component'
    and (id in (select id from sources) or (parent is not null and ($9::boolean or exists (select 1 from changed_components))))
),
wanted as (
  select id from components
  union
  select parent from components where parent is not null
  union
  select id from back where node #>> '{instance,component,node}' is not null
  union
  select id from chain
  union
  select id from generated
  union
  select n.id from generated
  cross join lateral (select n.id from deck.doom_node n where n.deck = $1 and n.parent = generated.id offset 0) n
  union
  select n.id from deck.doom_node n join chain on n.parent = chain.id
  where n.deck = $1 and chain.id = any($4::text[]) and chain.type = 'slideRow' and n.type = 'slide'
)
select s.owner, s.rev, s.runs, s.elements, s.slides, s.trashed is not null as trashed,
  exists (select 1 from deck.doom_node d where d.deck = s.id and d.type = 'deck') as has_deck,
  (select e.rev from deck.doom_edit e where e.deck = s.id and e.once = $3) as landed,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', n.id, 'node', n.node, 'revs', n.revs))
     from wanted cross join lateral (select n.id, n.node, n.revs from deck.doom_node n where n.deck = s.id and n.id = wanted.id offset 0) n),
    '[]'::jsonb
  ) as nodes
from deck.doom s where s.id = $1`

export type Part = {
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

function endNodes(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null) return []
  const { start, end } = value as { start?: unknown; end?: unknown }
  return [start, end].flatMap((each) => {
    const node = typeof each === "object" && each !== null ? (each as { node?: unknown }).node : undefined
    return typeof node === "string" ? [node] : []
  })
}

type Seeds = {
  readonly seeds: string[]
  readonly regrouped: string[]
  readonly removed: string[]
  readonly generated: string[]
  readonly components: string[]
  readonly createsComponent: boolean
}

export function seedsOf(edit: Readonly<Record<string, unknown>>): Seeds {
  const seeds = new Set<string>()
  const regrouped = new Set<string>()
  const removed = new Set<string>()
  const generated = new Set<string>()
  const components = new Set<string>()
  let createsComponent = false
  if (!Array.isArray(edit.writes))
    return { seeds: [], regrouped: [], removed: [], generated: [], components: [], createsComponent: false }
  for (const each of edit.writes as unknown[]) {
    if (typeof each !== "object" || each === null) continue
    const { node, prop, value } = each as { node?: unknown; prop?: unknown; value?: unknown }
    if (typeof node === "string") seeds.add(node)
    if (prop === "type" && value === "component") createsComponent = true
    if (typeof node === "string" && (prop === "parent" || prop === "hidden")) regrouped.add(node)
    if (typeof node === "string" && prop === "parent" && value === null) removed.add(node)
    const parent = typeof value === "object" && value !== null ? (value as { id?: unknown }).id : undefined
    if (prop === "parent" && typeof parent === "string") seeds.add(parent)
    if (prop === "instance" && typeof value === "object" && value !== null && "generated" in value) {
      const id = doom.readNodeId(value.generated)
      if (id !== undefined) generated.add(id)
      const ref = "component" in value ? value.component : undefined
      const source = typeof ref === "object" && ref !== null && "node" in ref ? doom.readNodeId(ref.node) : undefined
      if (source !== undefined) components.add(source)
    }
    if (prop === "geometry") for (const end of endNodes(value)) seeds.add(end)
  }
  return {
    seeds: [...seeds],
    regrouped: [...regrouped],
    removed: [...removed],
    generated: [...generated],
    components: [...components],
    createsComponent,
  }
}

export function partOf(part: Part): doom.Doom | undefined {
  const nodes = new Map<doom.NodeId, doom.Node>()
  const revs = new Map<doom.NodeId, ReadonlyMap<doom.RevisionKey, doom.Rev>>()
  const children = new Map<doom.NodeId, doom.NodeId[]>()
  for (const found of part.nodes) {
    const stored = doom.readStoredNode(found.id, found.node, found.revs)
    if (stored === undefined) return undefined
    nodes.set(stored.node.id, stored.node)
    revs.set(stored.node.id, stored.revs)
    if (stored.node.type === "slideRow") children.set(stored.node.id, [])
  }
  for (const node of nodes.values()) {
    const parent = doom.parentOf(node)
    if (parent == null) continue
    const siblings = children.get(parent.id) ?? []
    siblings.push(node.id)
    children.set(parent.id, siblings)
  }
  for (const siblings of children.values()) {
    siblings.sort((left, right) => {
      const a = doom.parentOf(nodes.get(left))?.at ?? ""
      const b = doom.parentOf(nodes.get(right))?.at ?? ""
      if (a !== b) return a < b ? -1 : 1
      return left < right ? -1 : 1
    })
  }
  const runs = doom.readRuns(part.runs)
  if (runs === undefined) return undefined
  return { nodes, revs, children, rev: doom.rev(part.rev), onces: new Map(), runs }
}
