import { measureWith, type Measure } from "./measure.js"
import {
  derivedCells,
  detachInverseConflicts,
  discardedOverrides,
  instanceFieldRevs,
  instanceRemovalConflicts,
  instanceTransition,
  measuredInstanceEdit,
  restoreInstance,
  readDiscardedOverrides,
  withRegenerated,
  type InstanceTransition,
} from "./component/instance-inverse.js"
import { type Instance, instanceFields, keyString } from "./component/instance.js"
import { sameValue } from "./changing-writes.js"
import { withPartDeletes } from "./component/instance-ownership.js"
import { withCurrentComponents } from "./component/component-edit.js"
import { withoutTemplateUpdate } from "./component/update-rebuild.js"
import { onDeck } from "./doom-walk.js"
import type { Doom, Landed, Node, Write } from "./doom.js"
import { readLanded } from "./fold-json.js"
import { type NodeId, type Rev, readNodeId, readRev } from "./ids.js"
import { props, type PropName, type WriteKey } from "./props.js"
import { readWriteKey } from "./read-write.js"
import { lineEndsBack } from "./line-ends-back.js"
import { onStandingLayers, type LayerPositions } from "./standing-layers.js"
import { type Refusal, isRefusal, refuse } from "./refusal.js"
import { type Theme, type ThemeKey, themeKeys, themeValueAt } from "./theme.js"

export type Replaced = {
  readonly node: NodeId
  readonly key: WriteKey
  readonly value: unknown
  readonly rev: Rev | null
  readonly compact?: true
  readonly fields?: ReturnType<typeof instanceFieldRevs>
  readonly overrides?: readonly Write[]
}
export type RunEdit = Landed & { readonly replaced: readonly Replaced[] }
export type Undone = {
  readonly writes: readonly Write[]
  readonly refused?: Refusal
  readonly kept: readonly NodeId[]
  readonly left: readonly NodeId[]
  readonly waiting: readonly NodeId[]
  readonly skipped: readonly NodeId[]
}

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
  const writes = withPartDeletes(before, edit.writes)
  return cellsOf(isRefusal(writes) ? edit : { writes }).map(({ node, key }) => ({
    node,
    key,
    value: valueIn(before.nodes.get(node), key),
    rev: before.revs.get(node)?.get(key) ?? null,
    ...(key === "instance"
      ? {
          fields: instanceFieldRevs(before, node),
          overrides: discardedOverrides(before, node, isRefusal(writes) ? edit.writes : writes),
        }
      : {}),
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
  const moves = writes.filter((write) => write.prop === "parent" && write.value !== null)
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
    ...writes.filter((write) => write.prop === "parent" && write.value === null),
  ]
}

function unshownOf(now: Doom, standing: readonly Write[], moved: readonly NodeId[]): ReadonlyMap<NodeId, boolean> {
  const landed = new Map(
    standing.flatMap((each) => (each.prop === "parent" ? [[each.node, each.value as { id: NodeId } | null]] : [])),
  )
  const above = (node: NodeId) =>
    landed.has(node)
      ? landed.get(node)
      : (now.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent
  const chain = (node: NodeId): NodeId[] | undefined => {
    const frames: NodeId[] = []
    let parent = above(node)
    for (let hops = 0; parent != null && hops <= now.nodes.size; hops += 1) {
      frames.push(parent.id)
      parent = above(parent.id)
    }
    return parent === undefined ? undefined : frames
  }
  const unshown = new Map(
    moved.flatMap((node) => {
      const frames = chain(node)
      return frames === undefined ? [] : [[node, frames] as const]
    }),
  )
  return new Map([...unshown].map(([node, frames]) => [node, !frames.some((frame) => unshown.has(frame))]))
}

function settle(
  now: Doom,
  edits: readonly RunEdit[],
  kept: ReadonlySet<NodeId>,
  restored: readonly Restore[],
  started: LayerPositions | Doom | undefined,
): Omit<Undone, "skipped"> {
  const parents = new Map(
    restored.filter(({ cell }) => cell.key === "parent").map(({ cell, value }) => [cell.node, value]),
  )
  const gone = (node: NodeId) => (parents.has(node) ? parents.get(node) === null : deleted(now, node))
  const writes = restored
    .filter(
      ({ cell, value }) => cell.key === "parent" || !gone(cell.node) || (cell.key === "instance" && value === null),
    )
    .map(({ cell, value, base }) => ({ node: cell.node, prop: cell.key, value, base }))
  const roots = [...kept].filter((node) => !kept.has(parentIn(now, node) as NodeId))
  const measuredIn = new Map<NodeId, NodeId | null>()
  for (const edit of edits)
    for (const was of edit.replaced)
      if (was.key === "parent" && !measuredIn.has(was.node))
        measuredIn.set(was.node, (was.value as { readonly id: NodeId } | null)?.id ?? null)
  const step = started === undefined ? undefined : { before: started, writes: edits.flatMap((edit) => edit.writes) }
  const standing = onStandingLayers(
    now,
    writes,
    edits.at(-1)?.rev ?? now.rev,
    edits[0]?.rev ?? now.rev,
    measuredIn,
    step,
  )
  const left = writes
    .filter((each) => each.prop === "parent" && each.value !== null && !standing.includes(each))
    .map((each) => each.node)
  const back = standing.filter((each) => each.prop === "parent" && each.value !== null).map((each) => each.node)
  const unshown = unshownOf(now, standing, [...left, ...back])
  return {
    writes: ordered(now, standing),
    kept: roots,
    left: left.filter((node) => !unshown.has(node)),
    waiting: [...left, ...back].filter((node) => unshown.get(node) === true),
  }
}

function writerOf(now: Doom, edits: readonly RunEdit[], mine: ReadonlySet<Rev>, cell: Cell): Rev | undefined {
  const at = now.revs.get(cell.node)?.get(cell.key)
  if (at === undefined || !mine.has(at) || edits.some((edit) => edit.rev === at)) return at
  const name = cellName(cell)
  return edits.findLast((edit) => edit.replaced.some(({ node, key }) => cellName({ node, key }) === name))?.rev
}

function linkedEdits(edits: readonly RunEdit[]) {
  const structural = new Set<NodeId>()
  const measured = new Set<Rev>()
  const byRoot = new Map<NodeId, [InstanceTransition, ...InstanceTransition[]]>()
  const byEdit = new Map<Rev, InstanceTransition[]>()
  for (const edit of edits) {
    const prior = new Map(edit.replaced.map((cell) => [cellName(cell), cell.value]))
    const transitions: InstanceTransition[] = []
    for (const { node, key, value, rev, fields, overrides } of edit.replaced) {
      if (key !== "instance") continue
      const before = props.instance.read(value)
      const previous = fields ?? Object.fromEntries(instanceFields.map((field) => [field, rev ?? undefined]))
      const change = isRefusal(before) ? undefined : instanceTransition(node, before, edit, previous, overrides ?? [])
      if (change === undefined) structural.add(node)
      else transitions.push(change)
    }
    if (
      transitions.some((change) =>
        measuredInstanceEdit(change, edit.writes, ({ node, prop }) => prior.get(cellName({ node, key: prop }))),
      )
    ) {
      measured.add(edit.rev)
      for (const { root } of transitions) structural.add(root)
      continue
    }
    if (transitions.length === 0) continue
    byEdit.set(edit.rev, transitions)
    for (const change of transitions) {
      const history = byRoot.get(change.root)
      byRoot.set(change.root, history === undefined ? [change] : [change, ...history])
    }
  }
  for (const node of structural) byRoot.delete(node)
  return { byRoot, byEdit, measured }
}

function withoutGenerated(applied: RunEdit, transitions: readonly InstanceTransition[], keepInstance = false): RunEdit {
  const previous = new Map(
    applied.replaced.filter(({ key }) => key === "fills").map(({ node, value }) => [node, value]),
  )
  const compact = new Set(applied.replaced.filter(({ compact }) => compact).map(({ node }) => node))
  const linked = new Set(transitions.map(({ root }) => root))
  const derived = derivedCells(
    transitions.filter(({ root }) => !compact.has(root)),
    applied.writes,
    (node) => previous.get(node),
  )
  const omit = (cell: Cell) => (cell.key === "instance" && linked.has(cell.node)) || derived(cell)
  return {
    ...applied,
    writes: applied.writes.filter(
      ({ node, prop }) => (keepInstance && prop === "instance") || !omit({ node, key: prop }),
    ),
    replaced: applied.replaced.filter((cell) => (keepInstance && cell.key === "instance") || !omit(cell)),
  }
}

function compactInstances({ before, after, overrides }: InstanceTransition) {
  const names = (parts: readonly { readonly key: Instance["parts"][number]["key"] }[]) =>
    new Set(parts.map(({ key }) => keyString(key)))
  const beforeSuppressed = names(before.suppressed)
  const afterSuppressed = names(after.suppressed)
  const overridden = new Set(overrides.map(({ node }) => node))
  const unchanged = {
    data: sameValue(before.data, after.data),
    tokens: sameValue(before.tokens, after.tokens),
    variant: sameValue(before.variant, after.variant),
    focus: sameValue(before.focus, after.focus),
  }
  const prior: Instance = {
    ...before,
    data: unchanged.data ? { rows: [] } : before.data,
    tokens: unchanged.tokens ? {} : before.tokens,
    variant: unchanged.variant ? {} : before.variant,
    focus: unchanged.focus ? [] : before.focus,
    parts: before.parts.filter(({ key, node }) => afterSuppressed.has(keyString(key)) || overridden.has(node)),
    suppressed: before.suppressed.filter(({ key }) => !afterSuppressed.has(keyString(key))),
  }
  const next: Instance = {
    ...after,
    data: unchanged.data ? { rows: [] } : after.data,
    tokens: unchanged.tokens ? {} : after.tokens,
    variant: unchanged.variant ? {} : after.variant,
    focus: unchanged.focus ? [] : after.focus,
    parts: after.parts.filter(({ key }) => beforeSuppressed.has(keyString(key))),
    suppressed: after.suppressed.filter(({ key }) => !beforeSuppressed.has(keyString(key))),
  }
  return [prior, next] as const
}

export function instanceAfterEdit(root: NodeId, value: unknown, edit: Landed): Instance | null | undefined {
  const written = edit.writes.findLast(({ node, prop }) => node === root && prop === "instance")
  if (written?.value === null) return null
  const prior = props.instance.read(written === undefined ? value : written.value)
  if (isRefusal(prior)) return undefined
  return written === undefined ? instanceTransition(root, prior, edit, {}, [])?.after : prior
}

export function undoSourceOf(before: Doom, edit: Landed): RunEdit {
  const expanded = withPartDeletes(before, edit.writes)
  const source = { ...edit, writes: isRefusal(expanded) ? edit.writes : expanded, replaced: replacedBy(before, edit) }
  const { byRoot, byEdit } = linkedEdits([source])
  const linked = byEdit.get(edit.rev)?.filter(({ root }) => byRoot.has(root)) ?? []
  const compact = new Map(linked.map((change) => [change.root, compactInstances(change)]))
  const filtered = withoutGenerated(source, linked, true)
  return {
    ...filtered,
    writes: filtered.writes.map((write) => {
      const pair = write.prop === "instance" ? compact.get(write.node) : undefined
      return pair === undefined ? write : { ...write, value: pair[1] }
    }),
    replaced: filtered.replaced.map((cell) => {
      const pair = cell.key === "instance" ? compact.get(cell.node) : undefined
      return pair === undefined ? cell : { ...cell, value: pair[0], compact: true as const }
    }),
  }
}

export function invertRun(
  now: Doom,
  asked: readonly RunEdit[],
  owned: ReadonlySet<Rev> = new Set(),
  started?: LayerPositions | Doom,
  measure: Measure = measureWith({}),
): Undone {
  const trimmed = asked.map((edit) => withoutTemplateUpdate(now, edit))
  const skipped = [...new Set(trimmed.flatMap((edit) => edit.skipped))]
  const edits = trimmed.map(({ skipped: _skipped, ...edit }) => edit)
  const mine = new Set<Rev>([...owned, ...edits.map((edit) => edit.rev)])
  const writer = new Map<string, Rev | null | undefined>()
  const restored = new Map<string, Restore>()
  const blocked = new Set<NodeId>()
  const chosen: RunEdit[] = []
  const { byRoot, byEdit, measured } = linkedEdits(edits)
  const structural = edits.map((edit) =>
    withoutGenerated(edit, byEdit.get(edit.rev)?.filter(({ root }) => byRoot.has(root)) ?? []),
  )
  const kept = keptOf(now, structural, mine)
  const rebuilt: Write[] = []
  const keptInstances: NodeId[] = []
  for (const transitions of byRoot.values()) {
    const restored = restoreInstance(now, transitions, owned, measure)
    if (isRefusal(restored)) return { writes: [], kept: [], left: [], waiting: [], skipped: [], refused: restored }
    rebuilt.push(...restored.writes)
    if (restored.kept) keptInstances.push(transitions[0].root)
  }
  const currentWriter = (was: Replaced) => {
    const name = cellName(was)
    if (!writer.has(name)) writer.set(name, writerOf(now, edits, mine, was))
    return writer.get(name)
  }
  for (const source of structural.toReversed()) {
    if (
      measured.has(source.rev) &&
      source.replaced.some((cell) => kept.has(cell.node) || currentWriter(cell) !== source.rev)
    ) {
      keptInstances.push(...source.replaced.flatMap(({ key, node }) => (key === "instance" ? [node] : [])))
      continue
    }
    const stays = ({ node }: { readonly node: NodeId }) => !kept.has(node)
    const edit = { ...source, writes: source.writes.filter(stays), replaced: source.replaced.filter(stays) }
    const roots = edit.replaced.flatMap(({ node, key }) => (key === "instance" ? [node] : []))
    if (roots.length > 0) {
      const restoredParents = new Set(
        [...restored.values()].flatMap(({ cell }) => (cell.key === "parent" ? [cell.node] : [])),
      )
      const removed = new Set(
        edit.writes.flatMap(({ node, prop, value }) => (prop === "parent" && value === null ? [node] : [])),
      )
      if (
        roots.some((root) => !onDeck(now.nodes, root) && !restoredParents.has(root) && !removed.has(root)) ||
        edit.replaced.some(
          (was) => (was.key === "instance" || was.key === "parent") && currentWriter(was) !== edit.rev,
        ) ||
        instanceRemovalConflicts(now, edit, mine, restoredParents) ||
        edit.writes.some(
          ({ node, prop, value }) =>
            prop === "instance" &&
            value === null &&
            !removed.has(node) &&
            detachInverseConflicts(
              now,
              node,
              edit.replaced.find((was) => was.key === "instance" && was.node === node)?.value,
              edit.rev,
              mine,
            ),
        )
      ) {
        roots.forEach((root) => blocked.add(root))
        continue
      }
    }
    chosen.push(edit)
    for (const was of edit.replaced) {
      const name = cellName(was)
      const other = currentWriter(was)
      if (other !== edit.rev) {
        if (was.key !== "geometry" || other == null || restored.has(name) || edits.some((each) => each.rev === other))
          continue
        const wrote = edit.writes.findLast((write) => write.node === was.node && write.prop === was.key)?.value
        const ends = lineEndsBack(was.value, valueIn(now.nodes.get(was.node), was.key), wrote)
        if (ends !== undefined) restored.set(name, { cell: was, value: ends, base: other })
        continue
      }
      restored.set(name, { cell: was, value: was.value, base: now.revs.get(was.node)!.get(was.key)! })
      writer.set(name, was.rev)
    }
  }
  const result = settle(now, chosen.reverse(), kept, [...restored.values()], started)
  const writes = withCurrentComponents(now, withRegenerated(result.writes, rebuilt), measure)
  if (isRefusal(writes)) return { writes: [], kept: [], left: [], waiting: [], skipped: [], refused: writes }
  return {
    ...result,
    kept: [...new Set([...result.kept, ...keptInstances])],
    writes,
    left: [...new Set([...result.left, ...blocked])],
    skipped,
  }
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
    const fields =
      key === "instance" && typeof cell.fields === "object" && cell.fields !== null
        ? Object.fromEntries(
            instanceFields.flatMap((field) => {
              const rev = readRev(Reflect.get(cell.fields as object, field))
              return rev === undefined ? [] : [[field, rev]]
            }),
          )
        : undefined
    const overrides = key === "instance" ? readDiscardedOverrides(cell.overrides, doom) : []
    replaced.push({
      node,
      key,
      value: cell.value ?? null,
      rev: at,
      ...(key === "instance" && cell.compact === true ? { compact: true as const } : {}),
      ...(fields === undefined ? {} : { fields }),
      ...(overrides.length === 0 ? {} : { overrides }),
    })
  }
  return { ...landed, replaced }
}
