import { componentWrites } from "./component/deck-component.js"
import { deletedInstances } from "./component/deleted-instances.js"
import { withReturningRebuilt } from "./component/component-edit.js"
import { applyBeforeFreeing } from "./apply-edit.js"
import {
  derivedCells,
  detachInverseConflicts,
  discardedOverrides,
  instanceFieldRevs,
  instanceRemovalConflicts,
  instanceTransition,
  measuredInstanceEdit,
  restoreInstance,
  withRegenerated,
} from "./component/instance-inverse.js"
import { measureWith, type Measure } from "./measure.js"
import { instanceRoots, withPartDeletes } from "./component/instance-ownership.js"
import { rev } from "./ids.js"
import { isRefusal, type Refusal } from "./refusal.js"
import type { NodeId, Rev } from "./ids.js"
import { type PropName, type WriteKey } from "./props.js"
import type { Landed, Doom, Write } from "./doom.js"
import { onDeck, propOf } from "./doom-walk.js"
import { lineEndsBack } from "./line-ends-back.js"
import { onStandingLayers } from "./standing-layers.js"
import { type Theme as ThemeValue, type ThemeKey, themeKeys, themeValueAt } from "./theme.js"

function keysOf(edit: Landed): readonly { readonly node: NodeId; readonly key: WriteKey }[] {
  const seen = new Set<string>()
  const keys: { node: NodeId; key: WriteKey }[] = []
  for (const { node, prop } of edit.writes) {
    if (prop === "type") continue
    for (const key of prop === "theme" ? themeKeys : [prop]) {
      if (seen.has(`${node}/${key}`)) continue
      seen.add(`${node}/${key}`)
      keys.push({ node, key })
    }
  }
  return keys
}

const parentIn = (doom: Doom, node: NodeId) =>
  (doom.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent ?? null

function depthIn(doom: Doom, node: NodeId): number {
  if (!doom.nodes.has(node)) return doom.nodes.size
  let depth = 0
  for (let at = parentIn(doom, node); at !== null && depth < doom.nodes.size; at = parentIn(doom, at.id)) depth += 1
  return depth
}

export function removePlacedInstance(
  now: Doom,
  root: NodeId,
  placed: Rev,
  owned: ReadonlySet<Rev>,
): readonly Write[] | undefined {
  const current = propOf(now.nodes.get(root), "instance")
  const parent = now.revs.get(root)?.get("parent")
  const instance = now.revs.get(root)?.get("instance")
  if (current === undefined || parent === undefined || instance === undefined) return undefined
  if (parent !== placed && !owned.has(parent)) return undefined
  const writes: Write[] = [{ node: root, prop: "instance", value: null, base: instance }]
  for (const node of [root, current.generated, ...current.parts.map((part) => part.node)]) {
    const base = now.revs.get(node)?.get("parent")
    if (base === undefined) return undefined
    writes.push({ node, prop: "parent", value: null, base })
  }
  return writes
}

export function invert(
  before: Doom,
  after: Doom,
  asked: Landed,
  owned: ReadonlySet<Rev> = new Set(),
  measure: Measure = measureWith({}),
): readonly Write[] {
  const result = invertStep(before, after, asked, owned, measure)
  return isRefusal(result) ? [] : result
}

export function invertStep(
  before: Doom,
  after: Doom,
  asked: Landed,
  owned: ReadonlySet<Rev> = new Set(),
  measure: Measure = measureWith({}),
): readonly Write[] | Refusal {
  const expanded = withPartDeletes(before, asked.writes)
  if (isRefusal(expanded)) return []
  const deleted = deletedInstances(after, expanded, (root) => propOf(before.nodes.get(root), "instance")).nodes
  const edit = { ...asked, writes: expanded.filter(({ node }) => !deleted.has(node)) }
  const joined = instanceRoots(edit.writes).flatMap((root) => {
    const prior = propOf(before.nodes.get(root), "instance")
    if (prior === undefined) return []
    const change = instanceTransition(
      root,
      prior,
      edit,
      instanceFieldRevs(before, root),
      discardedOverrides(before, root, edit.writes),
    )
    return change === undefined ? [] : [change]
  })
  const measured =
    componentWrites(before, expanded).size > 0 ||
    joined.some((change) =>
      measuredInstanceEdit(change, edit.writes, (write) => {
        if (write.prop === "box" || write.prop === "text") return propOf(before.nodes.get(write.node), write.prop)
        return undefined
      }),
    )
  const transitions = measured ? [] : joined
  const derived = derivedCells(transitions, edit.writes, (node, key) => propOf(before.nodes.get(node), key))
  const structural = { ...edit, writes: edit.writes.filter(({ node, prop }) => !derived({ node, key: prop })) }
  const roots = instanceRoots(structural.writes)
  const grouped = roots.length > 0
  const removed = new Set(
    edit.writes.flatMap(({ node, prop, value }) => (prop === "parent" && value === null ? [node] : [])),
  )
  const removedWith = (root: NodeId) => {
    let at: NodeId | undefined = root
    for (let hops = 0; at !== undefined && hops <= after.nodes.size; hops += 1) {
      if (removed.has(at)) return true
      at = parentIn(after, at)?.id
    }
    return false
  }
  if (roots.some((root) => !onDeck(after.nodes, root) && !removedWith(root))) return []
  if (grouped && instanceRemovalConflicts(after, structural, owned)) return []
  if (
    grouped &&
    edit.writes.some(
      ({ node, prop, value }) =>
        prop === "instance" &&
        value === null &&
        !removed.has(node) &&
        detachInverseConflicts(after, node, propOf(before.nodes.get(node), "instance"), edit.rev, owned),
    )
  )
    return []
  const writes: Write[] = []
  const placements = new Set<NodeId>()
  for (const root of roots) {
    if (parentIn(before, root) !== null) continue
    if (propOf(after.nodes.get(root), "instance") === undefined) continue
    const removal = removePlacedInstance(after, root, edit.rev, owned)
    if (removal === undefined) return []
    writes.push(...removal)
    for (const { node } of removal) placements.add(node)
  }
  for (const { node, key } of keysOf(structural)) {
    if (placements.has(node) && (key === "parent" || key === "instance")) continue
    const writer = after.revs.get(node)?.get(key)
    if (writer === undefined) {
      if (measured) return { refused: "stale", node, prop: key }
      if (grouped && key === "instance") return []
      continue
    }
    if (writer !== edit.rev && !owned.has(writer)) {
      if (measured) return { refused: "stale", node, prop: key }
      if (grouped && key === "instance") return []
      const wrote = edit.writes.findLast((write) => write.node === node && write.prop === "geometry")?.value
      const ends =
        key === "geometry"
          ? lineEndsBack(propOf(before.nodes.get(node), "geometry"), propOf(after.nodes.get(node), "geometry"), wrote)
          : undefined
      if (ends !== undefined) writes.push({ node, prop: key, value: ends, base: writer })
      continue
    }
    const was = before.nodes.get(node)
    if (was === undefined) {
      if (key === "parent") writes.push({ node, prop: key, value: null, base: writer })
      continue
    }
    const value = key.startsWith("theme.")
      ? themeValueAt((was as { theme: ThemeValue }).theme, key as ThemeKey)
      : (was as Record<string, unknown>)[key as PropName]
    writes.push({ node, prop: key, value: value ?? null, base: writer })
  }
  const measuredIn = new Map(writes.map(({ node }) => [node, parentIn(before, node)?.id ?? null]))
  const standing = onStandingLayers(after, writes, edit.rev, edit.rev, measuredIn, { before, writes: edit.writes })
  if (measured && standing.length !== writes.length) return { refused: "stale" }
  if (writes.some((write) => write.prop === "parent" && placements.has(write.node) && !standing.includes(write)))
    return []
  const moves = standing.filter((each) => each.prop === "parent" && each.value !== null)
  const depths = new Map(moves.map((each) => [each.node, depthIn(before, each.node)]))
  moves.sort((one, other) => depths.get(one.node)! - depths.get(other.node)!)
  const rebuilt: Write[] = []
  for (const change of transitions) {
    const restored = restoreInstance(after, [change], owned, measure)
    if (isRefusal(restored)) return restored
    rebuilt.push(...restored.writes)
  }
  const reversed = withRegenerated(
    [
      ...moves,
      ...standing.filter((each) => each.prop !== "parent"),
      ...standing.filter((each) => each.prop === "parent" && each.value === null),
    ],
    rebuilt,
  )
  const inverse = withReturningRebuilt(after, reversed, measure)
  if (isRefusal(inverse)) return inverse
  if (grouped || rebuilt.length > 0 || inverse !== reversed) {
    const trial = applyBeforeFreeing(after, {
      once: edit.once + ":inverse",
      author: { kind: "person", id: "inverse" },
      rev: rev(after.rev + 1),
      readBase: after.rev,
      writes: inverse,
    })
    if (isRefusal(trial)) return rebuilt.length === 0 && inverse === reversed ? [] : trial
  }
  return inverse
}
