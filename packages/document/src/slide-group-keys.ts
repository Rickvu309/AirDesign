import type { SlideId } from "./element-id.js"
import { sectionRuns } from "./section-order.js"
import type { LegacySlideCommand } from "./slide-order.js"

export type HeadTag = { readonly key: string | null; readonly made: boolean }
export type Tagged = { readonly starts: readonly SlideId[]; readonly keys: readonly string[] }

export function partition(ids: readonly SlideId[], starts: ReadonlySet<SlideId>): [SlideId, ...SlideId[]][] {
  const rows: [SlideId, ...SlideId[]][] = []
  for (const id of ids) {
    const last = rows.at(-1)
    if (last === undefined || starts.has(id)) rows.push([id])
    else last.push(id)
  }
  return rows
}

export function sectionsOf(
  file: readonly SlideId[],
  effects: readonly LegacySlideCommand[],
  ids: readonly SlideId[],
  starts: readonly SlideId[] | undefined,
): ReadonlyMap<SlideId, number> {
  if (starts === undefined || starts.length === 0) return new Map()
  const runs = sectionRuns(file, effects, ids, partition(file, new Set(starts)))
  return new Map(runs.flatMap((run, number) => run.map((id) => [id, number] as const)))
}

export function openingTags(
  starts: readonly SlideId[],
  sections: ReadonlyMap<SlideId, number>,
  ids: readonly SlideId[],
  named: boolean,
): Map<SlideId, HeadTag> {
  const first = new Map<SlideId, string>()
  for (const [position, id] of ids.entries()) {
    const number = sections.get(id)
    if (named && number !== undefined && (position === 0 || sections.get(ids[position - 1]!) !== number))
      first.set(id, `f${String(number)}`)
  }
  return new Map(starts.map((id) => [id, { key: first.get(id) ?? null, made: false }]))
}

export function mappedSlideGroups(
  ids: readonly SlideId[],
  tags: ReadonlyMap<SlideId, HeadTag> | null,
  sections: ReadonlyMap<SlideId, number>,
): Tagged {
  const held = new Set([...(tags?.values() ?? [])].flatMap((tag) => (tag.key === null ? [] : [tag.key])))
  const starts: SlideId[] = []
  const keys: string[] = []
  const given = new Set<string>()
  let made = false
  for (const [position, id] of ids.entries()) {
    const tag = tags?.get(id)
    const afterMade = made && tag !== undefined
    if (tag !== undefined) made = tag.made
    const section = `f${String(sections.get(id) ?? 0)}`
    const boundary = position === 0 || sections.get(id) !== sections.get(ids[position - 1]!)
    const own = tag?.key ?? null
    const free = !held.has(section) && !given.has(section)
    const claimed = own !== null && !own.startsWith("f") && boundary && free && sections.has(id)
    const key =
      own !== null && !given.has(own) && !claimed
        ? own
        : boundary && free
          ? section
          : afterMade || position === 0
            ? free
              ? section
              : `r${id}`
            : null
    if (key === null) continue
    starts.push(id)
    keys.push(key)
    given.add(key)
  }
  return { starts, keys }
}

export type Retag = {
  readonly ids: readonly SlideId[]
  readonly heads: ReadonlySet<SlideId>
  readonly staying: (id: SlideId) => boolean
  readonly memory: Map<SlideId, HeadTag>
  readonly fresh: string
  readonly kept: SlideId | null
  readonly turn: boolean
}

function remember(memory: Map<SlideId, HeadTag>, head: SlideId, tag: HeadTag): void {
  if (tag.key !== null) for (const [id, held] of memory) if (held.key === tag.key) memory.delete(id)
  memory.set(head, tag)
}

export function retag(
  rows: readonly (readonly SlideId[])[],
  tags: ReadonlyMap<SlideId, HeadTag>,
  { ids, heads, staying, memory, fresh, kept, turn }: Retag,
): Map<SlideId, HeadTag> {
  const present = new Set(ids)
  const after = partition(ids, heads)
  const owner = new Map(after.flatMap((row) => row.map((id) => [id, row[0]] as const)))
  const next = new Map<SlideId, HeadTag>()
  const carried = new Set<number>()
  const carry = (number: number, id: SlideId | undefined) => {
    const tag = tags.get(rows[number]![0]!)
    const head = id === undefined ? undefined : owner.get(id)
    if (tag === undefined || head === undefined || next.has(head)) return
    next.set(head, tag)
    carried.add(number)
  }
  for (const [number, row] of rows.entries()) carry(number, row.find(staying))
  for (const [number, row] of rows.entries())
    if (!row.some(staying))
      carry(
        number,
        row.find((id) => present.has(id)),
      )
  for (const [number, row] of rows.entries()) {
    const tag = tags.get(row[0]!)
    if (tag !== undefined && !carried.has(number)) remember(memory, row[0]!, tag)
  }
  const used = new Set([...next.values()].flatMap((tag) => (tag.key === null ? [] : [tag.key])))
  let count = 0
  const fresher = () => (count++ === 0 ? fresh : `${fresh}.${String(count - 1)}`)
  for (const [head] of after) {
    if (next.has(head)) continue
    const remembered = turn ? memory.get(head) : undefined
    const tag =
      remembered !== undefined && (remembered.key === null || !used.has(remembered.key))
        ? remembered
        : { key: fresher(), made: true }
    if (tag.key !== null) used.add(tag.key)
    next.set(head, tag)
  }
  const moved = kept === null ? undefined : owner.get(kept)
  const tag = moved === undefined ? undefined : next.get(moved)
  if (moved !== undefined && tag !== undefined) next.set(moved, { key: tag.key ?? fresher(), made: true })
  return next
}
