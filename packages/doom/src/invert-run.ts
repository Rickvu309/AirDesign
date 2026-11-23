import type { Doom, Landed, Node, Write } from "./doom.js"
import { readLanded } from "./fold-json.js"
import { type NodeId, type Rev, readNodeId, readRev } from "./ids.js"
import type { PropName, WriteKey } from "./props.js"
import { readWriteKey } from "./read-write.js"
import { onStandingLayers } from "./standing-layers.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import { type Theme, type ThemeKey, themeKeys, themeValueAt } from "./theme.js"

export type Replaced = {
  readonly node: NodeId
  readonly key: WriteKey
  readonly value: unknown
  readonly rev: Rev | null
}
export type RunEdit = Landed & { readonly replaced: readonly Replaced[] }
export type Undone = { readonly writes: readonly Write[]; readonly kept: readonly NodeId[] }

type Cell = { readonly node: NodeId; readonly key: WriteKey }
type Restore = { readonly cell: Cell; readonly value: unknown; readonly base: Rev }

const cellName = ({ node, key }: Cell) => `${node}\u0000${key}`

function cellsOf(edit: Pick<Landed, "writes">): readonly Cell[] {
  const cells = new Map<string, Cell>()
  for (const { node, prop } of edit.writes) {
    if (prop === "type") continue
    for (const key of prop === "theme" ? themeKeys : [prop]) cells.set(cellName({ node, key }), { node, key })
  }
  return [...cells.values()]
}

function valueIn(node: Node | undefined, key: WriteKey): unknown {
  if (node === undefined) return null
  const value = key.startsWith("theme.")
    ? themeValueAt((node as { theme: Theme }).theme, key as ThemeKey)
    : (node as Record<string, unknown>)[key as PropName]
  return value ?? null
}

export function replacedBy(before: Doom, edit: Pick<Landed, "writes">): readonly Replaced[] {
  return cellsOf(edit).map(({ node, key }) => ({
    node,
    key,
    value: valueIn(before.nodes.get(node), key),
    rev: before.revs.get(node)?.get(key) ?? null,
  }))
}

const parentIn = (doom: Doom, node: NodeId): NodeId | null =>
  (doom.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent?.id ?? null

const deleted = (doom: Doom, node: NodeId) =>
  (doom.nodes.get(node) as { parent?: unknown } | undefined)?.parent === null

function keptOf(now: Doom, edits: readonly Landed[], mine: ReadonlySet<Rev>): ReadonlySet<NodeId> {
  const since = edits[0]?.rev ?? now.rev
  const touchedSince = (node: NodeId) =>
    [...(now.revs.get(node)?.values() ?? [])].some((at) => at > since && !mine.has(at))
  const subtree = (node: NodeId): NodeId[] => [node, ...(now.children.get(node) ?? []).flatMap(subtree)]
  const kept = new Set<NodeId>()
  for (const edit of edits)
    for (const write of edit.writes) {
      if (write.prop !== "type" || kept.has(write.node) || deleted(now, write.node)) continue
      const under = subtree(write.node)
      if (under.some(touchedSince)) for (const each of under) kept.add(each)
    }
  return kept
}

function ordered(now: Doom, writes: readonly Write[]): readonly Write[] {
  const moves = writes.filter((write) => write.prop === "parent")
  const movedTo = new Map(moves.map((write) => [write.node, (write.value as { id: NodeId } | null)?.id ?? null]))
  const depth = (node: NodeId): number => {
    let at = node
    for (let hops = 0; hops <= now.nodes.size; hops += 1) {
      const next = movedTo.has(at) ? movedTo.get(at)! : parentIn(now, at)
      if (next === null) return movedTo.has(at) ? now.nodes.size : hops
      at = next
    }
    return now.nodes.size
  }
  const depths = new Map(moves.map((write) => [write.node, depth(write.node)]))
  return [
    ...[...moves].sort((one, other) => depths.get(one.node)! - depths.get(other.node)!),
    ...writes.filter((write) => write.prop !== "parent"),
  ]
}

function settle(now: Doom, edits: readonly Landed[], mine: ReadonlySet<Rev>, restored: readonly Restore[]): Undone {
  const kept = keptOf(now, edits, mine)
  const chosen = restored.filter(({ cell }) => !kept.has(cell.node))
  const parents = new Map(
    chosen.filter(({ cell }) => cell.key === "parent").map(({ cell, value }) => [cell.node, value]),
  )
  const gone = (node: NodeId) => (parents.has(node) ? parents.get(node) === null : deleted(now, node))
  const writes = chosen
    .filter(({ cell }) => cell.key === "parent" || !gone(cell.node))
    .map(({ cell, value, base }) => ({ node: cell.node, prop: cell.key, value, base }))
  const roots = [...kept].filter((node) => !kept.has(parentIn(now, node) as NodeId))
  return { writes: ordered(now, onStandingLayers(now, writes)), kept: roots }
}

function writerOf(now: Doom, edits: readonly Landed[], mine: ReadonlySet<Rev>, cell: Cell): Rev | undefined {
  const at = now.revs.get(cell.node)?.get(cell.key)
  if (at === undefined || !mine.has(at) || edits.some((edit) => edit.rev === at)) return at
  const name = cellName(cell)
  return edits.findLast((edit) => cellsOf(edit).some((each) => cellName(each) === name))?.rev
}

export function invertRun(now: Doom, edits: readonly RunEdit[], owned: ReadonlySet<Rev> = new Set()): Undone {
  const mine = new Set<Rev>([...owned, ...edits.map((edit) => edit.rev)])
  const writer = new Map<string, Rev | null | undefined>()
  const restored = new Map<string, Restore>()
  for (const edit of [...edits].reverse())
    for (const was of edit.replaced) {
      const name = cellName(was)
      if (!writer.has(name)) writer.set(name, writerOf(now, edits, mine, was))
      if (writer.get(name) !== edit.rev) continue
      restored.set(name, { cell: was, value: was.value, base: now.revs.get(was.node)!.get(was.key)! })
      writer.set(name, was.rev)
    }
  return settle(now, edits, mine, [...restored.values()])
}

export function readRunEdit(raw: unknown, rawReplaced: unknown, doom: Doom): RunEdit | Refusal {
  if (!Array.isArray(rawReplaced)) return refuse("shape")
  const landed = readLanded(raw, doom)
  if (isRefusal(landed)) return landed
  const replaced: Replaced[] = []
  for (const each of rawReplaced) {
    const cell = (typeof each === "object" && each !== null ? each : {}) as Record<string, unknown>
    const node = readNodeId(cell.node)
    const key = readWriteKey(cell.key)
    const at = cell.rev === null ? null : readRev(cell.rev)
    if (node === undefined || key === undefined || at === undefined) return refuse("shape")
    replaced.push({ node, key, value: cell.value ?? null, rev: at })
  }
  return { ...landed, replaced }
}
