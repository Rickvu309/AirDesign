import { sameValue } from "../changing-writes.js"
import {
  hasBaselineFill,
  instanceFieldKey,
  instanceFields,
  keyString,
  type Instance,
  type InstanceField,
} from "./instance.js"
import { restoreComponent, type ComponentPatch, type SuppressionChange } from "./join-instance.js"
import type { Doom, Landed, Write } from "../doom.js"
import { onDeck, parentOf, propOf } from "../doom-walk.js"
import type { NodeId, Rev } from "../ids.js"
import { props } from "../props.js"
import { readWrite } from "../read-write.js"
import { isRefusal } from "../refusal.js"
import type { Measure } from "../measure.js"
import { onStandingLayers } from "../standing-layers.js"
import { instanceFits, instanceRoots } from "./instance-ownership.js"
import { changesBoxSize, writesTheme } from "./component-edit.js"

export function instanceRemovalConflicts(
  now: Doom,
  edit: Landed,
  owned: ReadonlySet<Rev>,
  restoringParents: ReadonlySet<NodeId> = new Set(),
): boolean {
  const created = new Set(edit.writes.flatMap(({ node, prop }) => (prop === "type" ? [node] : [])))
  if (created.size === 0) return false
  for (const node of instanceRoots(edit.writes)) {
    const current = created.has(node) ? propOf(now.nodes.get(node), "instance") : undefined
    if (current === undefined) continue
    created.add(current.generated)
    for (const part of current.parts) created.add(part.node)
  }
  const later = (at: Rev) => at > edit.rev && !owned.has(at)
  for (const node of created) {
    if ((now.children.get(node) ?? []).some((child) => !created.has(child) && !restoringParents.has(child))) return true
  }
  for (const node of now.nodes.values()) {
    const line = propOf(node, "geometry")
    if (line?.kind !== "line" || created.has(node.id)) continue
    if ([line.start, line.end].some((end) => "node" in end && created.has(end.node)) && onDeck(now.nodes, node.id)) {
      const at = now.revs.get(node.id)?.get("geometry")
      if (at === undefined || later(at)) return true
    }
  }
  return false
}

export function detachInverseConflicts(
  now: Doom,
  root: NodeId,
  value: unknown,
  at: Rev,
  owned: ReadonlySet<Rev>,
): boolean {
  if (value == null) return false
  const instance = props.instance.read(value)
  if (isRefusal(instance) || !onDeck(now.nodes, root) || !instanceFits(now, root, instance)) return true
  const later = (node: NodeId, keys: readonly string[]) =>
    [...(now.revs.get(node) ?? [])].some(([key, rev]) => keys.includes(key) && rev > at && !owned.has(rev))
  if (later(instance.generated, ["box", "layout", "sizing", "parent"])) return true
  return instance.parts.some(
    ({ node }) =>
      parentOf(now.nodes.get(node))?.id !== instance.generated ||
      later(node, ["box", "geometry", "text", "parent", "layout", "sizing", "absolute", "cell"]),
  )
}

type FieldRevs = Partial<Record<InstanceField, Rev>>
export type InstanceTransition = {
  readonly root: NodeId
  readonly rev: Rev
  readonly before: Instance
  readonly after: Instance
  readonly fields: FieldRevs
  readonly overrides: readonly Write[]
}

export function measuredInstanceEdit(
  { root, before, after }: InstanceTransition,
  writes: readonly Write[],
  prior: (write: Write) => unknown,
): boolean {
  const changesLayout = writes.some(
    (write) =>
      writesTheme(write) || (write.node === root && write.prop === "box" && changesBoxSize(write.value, prior(write))),
  )
  if (changesLayout || !sameValue(before.component, after.component)) return true
  const text = writes.filter(({ prop }) => prop === "text")
  if (text.length === 0) return false
  const styles = (instance: Instance) =>
    new Map(
      instance.parts.flatMap(({ node, baseline }) =>
        baseline.kind === "text" ? [[node, baseline.style] as const] : [],
      ),
    )
  const old = styles(before)
  const next = styles(after)
  const inputsChanged = instanceFields.some((field) => !sameValue(before[field], after[field]))
  return text.some(changedStyle)

  function changedStyle(write: Write): boolean {
    const wasStyle = old.get(write.node)
    const becameStyle = next.get(write.node)
    if (wasStyle === undefined || becameStyle === undefined) return false
    const was = props.text.read(prior(write))
    const became = props.text.read(write.value)
    return (
      !isRefusal(was) &&
      !isRefusal(became) &&
      was.style !== became.style &&
      (!inputsChanged || was.style !== wasStyle || became.style !== becameStyle)
    )
  }
}

export function instanceTransition(
  root: NodeId,
  before: Instance,
  edit: Landed,
  fields: FieldRevs,
  overrides: readonly Write[],
): InstanceTransition | undefined {
  const written = edit.writes.findLast(({ node, prop }) => node === root && prop === "instance")
  if (written === undefined) {
    const deleted = new Set(
      edit.writes.flatMap(({ node, prop, value }) => (prop === "parent" && value === null ? [node] : [])),
    )
    const gone = before.parts.filter(({ node }) => deleted.has(node))
    if (gone.length === 0) return undefined
    const after: Instance = {
      ...before,
      parts: before.parts.filter(({ node }) => !deleted.has(node)),
      suppressed: [...before.suppressed, ...gone.map(({ key }) => ({ key, reason: "delete" as const }))],
    }
    return { root, rev: edit.rev, before, after, fields, overrides }
  }
  const after = props.instance.read(written.value)
  return isRefusal(after) || before.generated !== after.generated
    ? undefined
    : { root, rev: edit.rev, before, after, fields, overrides }
}

export function instanceFieldRevs(now: Doom, root: NodeId): FieldRevs {
  const stamps = now.revs.get(root)
  return Object.fromEntries(
    instanceFields.flatMap((field) => {
      const at = stamps?.get(instanceFieldKey(field)) ?? stamps?.get("instance")
      return at === undefined ? [] : [[field, at]]
    }),
  )
}

function suppressionDelta({ before, after, rev }: InstanceTransition): readonly SuppressionChange[] {
  const was = new Set(before.suppressed.map(({ key }) => keyString(key)))
  const did = new Set(after.suppressed.map(({ key }) => keyString(key)))
  return [
    ...before.parts.flatMap((part) => (did.has(keyString(part.key)) ? [{ ...part, rev, wasSuppressed: false }] : [])),
    ...after.parts.flatMap((part) => (was.has(keyString(part.key)) ? [{ ...part, rev, wasSuppressed: true }] : [])),
  ]
}

export function discardedOverrides(before: Doom, root: NodeId, writes: readonly Write[]): readonly Write[] {
  const prior = propOf(before.nodes.get(root), "instance")
  const written = writes.findLast(({ node, prop }) => node === root && prop === "instance")
  if (prior === undefined || written === undefined) return []
  const next = props.instance.read(written.value)
  if (isRefusal(next) || prior.generated !== next.generated) return []
  const kept = new Set([...next.parts, ...next.suppressed, ...(next.unfitted ?? [])].map(({ key }) => keyString(key)))
  const overrides: Write[] = []
  for (const { node, key, baseline } of [...prior.parts, ...(prior.unfitted ?? [])]) {
    if (kept.has(keyString(key))) continue
    const current = before.nodes.get(node)
    if (current?.type !== "shape") continue
    if (hasBaselineFill(baseline) && !sameValue(current.fills ?? [], baseline.fills))
      overrides.push({ node, prop: "fills", value: current.fills ?? null })
    if (baseline.kind === "text" && current.text !== undefined && current.text.style !== baseline.style)
      overrides.push({ node, prop: "text", value: current.text })
    if (current.name !== undefined && current.name !== key.join(" / "))
      overrides.push({ node, prop: "name", value: current.name })
    if (current.link !== undefined) overrides.push({ node, prop: "link", value: current.link })
  }
  return overrides
}

export function readDiscardedOverrides(raw: unknown, now: Doom): readonly Write[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((value: unknown) => {
    const write = readWrite(value, now)
    return isRefusal(write) || !["fills", "text", "name", "link"].includes(write.prop) ? [] : [write]
  })
}

export function derivedCells(
  transitions: readonly InstanceTransition[],
  writes: readonly Write[],
  prior: (node: NodeId, key: "fills") => unknown,
) {
  const parts = new Set<NodeId>()
  const created = new Set<NodeId>()
  const regenerated = new Set<NodeId>()
  const roots = new Set<NodeId>()
  const explicitFills = new Set<NodeId>()
  const fills = new Map(writes.filter(({ prop }) => prop === "fills").map(({ node, value }) => [node, value]))
  for (const { before, after, root } of transitions) {
    roots.add(root)
    parts.add(before.generated)
    const old = new Map(before.parts.map(({ node, baseline }) => [node, baseline]))
    const rejoin = instanceFields.some((field) => !sameValue(before[field], after[field]))
    before.parts.forEach(({ node }) => parts.add(node))
    for (const { node, baseline } of after.parts) {
      const previous = old.get(node)
      if (
        hasBaselineFill(baseline) &&
        hasBaselineFill(previous) &&
        fills.has(node) &&
        (!sameValue(fills.get(node) ?? [], baseline.fills) || !sameValue(prior(node, "fills") ?? [], previous.fills))
      )
        explicitFills.add(node)
      parts.add(node)
      if (rejoin || !old.has(node)) regenerated.add(node)
      if (!old.has(node)) created.add(node)
    }
  }
  return ({ node, key }: { readonly node: NodeId; readonly key: string }) =>
    (key === "instance" && roots.has(node)) ||
    (parts.has(node) && (key === "parent" || key === "box")) ||
    (regenerated.has(node) &&
      (["type", "geometry", "strokes", "stroke", "text"].includes(key) ||
        (key === "fills" && !explicitFills.has(node)))) ||
    (created.has(node) && (key === "name" || key === "link"))
}

export function restoreInstance(
  now: Doom,
  transitions: readonly [InstanceTransition, ...InstanceTransition[]],
  owned: ReadonlySet<Rev>,
  measure: Measure,
) {
  const [{ root, before, rev }] = transitions
  const current = propOf(now.nodes.get(root), "instance")
  if (current?.generated !== before.generated || !onDeck(now.nodes, root)) return { writes: [], kept: false }
  const test: Write = { node: root, prop: "instance", value: current }
  if (onStandingLayers(now, [test], rev, rev, new Map()).length === 0) return { writes: [], kept: false }
  const fields = instanceFieldRevs(now, root)
  let values = current
  let kept = false
  const expired: Instance["suppressed"][number][] = []
  const returning = new Map<
    string,
    { readonly part: Instance["parts"][number]; readonly overrides: readonly Write[] }
  >()
  for (const change of transitions) {
    let restoresKeys = false
    for (const field of instanceFields) {
      if (sameValue(change.before[field], change.after[field])) continue
      const at = fields[field]
      if (at !== change.rev && (at === undefined || !owned.has(at))) {
        kept ||= at !== undefined && at > change.rev
        continue
      }
      if (!sameValue(values[field], change.after[field])) continue
      values = { ...values, [field]: change.before[field] }
      const previous = change.fields[field]
      if (previous === undefined) delete fields[field]
      else fields[field] = previous
      restoresKeys ||= field !== "tokens"
    }
    if (restoresKeys) {
      const afterKeys = new Set(
        [...change.after.parts, ...change.after.suppressed, ...(change.after.unfitted ?? [])].map(({ key }) =>
          keyString(key),
        ),
      )
      expired.push(...change.before.suppressed.filter(({ key }) => !afterKeys.has(keyString(key))))
      const byNode = new Map<NodeId, Write[]>()
      for (const write of change.overrides) {
        const writes = byNode.get(write.node)
        if (writes === undefined) byNode.set(write.node, [write])
        else writes.push(write)
      }
      for (const part of [...change.before.parts, ...(change.before.unfitted ?? [])]) {
        const key = keyString(part.key)
        const overrides = byNode.get(part.node)
        if (!afterKeys.has(key) && overrides !== undefined) returning.set(key, { part, overrides })
      }
    }
  }
  const patch: ComponentPatch = Object.fromEntries(
    instanceFields.flatMap((field) => (sameValue(values[field], current[field]) ? [] : [[field, values[field]]])),
  )
  const restored = restoreComponent(
    now,
    root,
    before.generated,
    transitions.flatMap(suppressionDelta),
    owned,
    measure,
    patch,
    expired,
    returning,
  )
  return isRefusal(restored)
    ? { ...restored, node: root, prop: "instance" as const }
    : { writes: restored.writes, kept }
}

export function withRegenerated(writes: readonly Write[], regenerated: readonly Write[]): readonly Write[] {
  if (regenerated.length === 0) return writes
  const fills = new Set(writes.filter(({ prop }) => prop === "fills").map(({ node }) => node))
  return [...writes, ...regenerated.filter(({ node, prop }) => prop !== "fills" || !fills.has(node))]
}
