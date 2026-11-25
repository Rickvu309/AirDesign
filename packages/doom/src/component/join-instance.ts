import { changingWrites, sameValue } from "../changing-writes.js"
import { deckOf } from "../deck-of.js"
import type { Doom, Node, Write } from "../doom.js"
import { onDeck, propOf } from "../doom-walk.js"
import { freeLineEnds, lostBy } from "../freed-line-ends.js"
import type { End } from "../geometry.js"
import { type NodeId, type Rev } from "../ids.js"
import { bytesOf, limits } from "../limits.js"
import type { Measure } from "../measure.js"
import { orderKeyBetween } from "../order-key.js"
import { siteSpot } from "../preset-geometry.js"
import { props, type Props } from "../props.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { expandComponent, type ComponentInput } from "./expand-component.js"
import { hasBaselineFill, keyString, type Instance, type PartBaseline, type PartKey } from "./instance.js"
import { type ComponentDefinition, resolveComponent } from "./library.js"
import type { ComponentNode, ComponentTree } from "./nodes.js"
import { partId } from "./part-id.js"

export type ComponentUpdateFinding =
  | {
      readonly kind: "discarded-override"
      readonly key: PartKey
      readonly node: NodeId
      readonly prop: "fills" | "text" | "name" | "link"
    }
  | { readonly kind: "discarded-suppression"; readonly key: PartKey }
  | { readonly kind: "freed-end"; readonly line: NodeId; readonly end: "start" | "end"; readonly target: NodeId }

export type ComponentUpdate = {
  readonly writes: readonly Write[]
  readonly findings: readonly ComponentUpdateFinding[]
}

type Inputs = Pick<ComponentInput, "variant" | "tokens" | "data">
export type ComponentPatch = Partial<Inputs>

type InstanceFrame = Extract<Node, { type: "frame" }> & { instance: Instance }

function linked(doom: Doom, frame: NodeId): InstanceFrame | undefined {
  const node = doom.nodes.get(frame)
  if (node?.type !== "frame" || node.instance === undefined || !onDeck(doom.nodes, frame)) return undefined
  return { ...node, instance: node.instance }
}

function baselineOf(node: ComponentNode): PartBaseline {
  if (node.props.text !== undefined) return { kind: "text", style: node.generatedStyle ?? node.props.text.style }
  if (node.props.geometry.kind === "line") return { kind: "line" }
  return { kind: node.props.geometry.kind === "path" ? "path" : "rect", fills: node.props.fills ?? [] }
}

function saveInstance(
  doom: Doom,
  frame: NodeId,
  raw: unknown,
  writes: readonly Write[],
  measure: Measure,
  parked: readonly Write[] = [],
): readonly Write[] | Refusal {
  const found = props.instance.read(raw)
  if (isRefusal(found)) return { ...found, node: frame, prop: "instance" }
  const prior = doom.nodes.get(frame)
  const changed = changingWrites(doom, writes)
  if (changed.length === 0 && prior?.type === "frame" && sameValue(prior.instance, found)) return []
  const all = freeLineEnds(doom, [...changed, ...parked, { node: frame, prop: "instance", value: found }], measure)
  if (bytesOf(JSON.stringify(found)) >= limits.row || bytesOf(JSON.stringify(all)) >= limits.body - limits.form)
    return refuse("limit", frame, "instance")
  return all
}

const partProps = ["box", "geometry", "fills", "strokes", "stroke", "text"] as const

function join(
  doom: Doom,
  frame: NodeId,
  instance: Omit<Instance, keyof Inputs | "parts"> & Inputs,
  previous: Instance | undefined,
  tree: ComponentTree,
  create: readonly Write[],
  measure: Measure,
  returning?: ReadonlyMap<string, Instance["parts"][number]>,
  restored?: ReadonlyMap<NodeId, readonly Write[]>,
): ComponentUpdate | Refusal {
  const old = new Map(previous?.parts.map((part) => [keyString(part.key), part]))
  const findings: ComponentUpdateFinding[] = []
  const emittedKeys = new Set(tree.children.map(({ key }) => keyString(key)))
  const kept = instance.suppressed.filter(({ key }) => {
    if (emittedKeys.has(keyString(key))) return true
    findings.push({ kind: "discarded-suppression", key })
    return false
  })
  const suppressed = new Set(kept.map(({ key }) => keyString(key)))
  const writes: Write[] = [...create, { node: instance.generated, prop: "box", value: tree.props.box }]
  const active = tree.children
    .filter((part) => !suppressed.has(keyString(part.key)))
    .map((part) => {
      const baseline = baselineOf(part)
      const record = old.get(keyString(part.key)) ?? returning?.get(keyString(part.key))
      const reused = record?.baseline.kind === baseline.kind ? record : undefined
      if (reused !== undefined) old.delete(keyString(part.key))
      const node = reused?.node ?? partId(frame, part.key)
      return { part, baseline, reused, node }
    })
  const ids = new Map(active.map(({ part, node }) => [part.id, node]))
  const emitted = new Map(tree.children.map((part) => [part.id, part]))
  const end = (point: End): End | undefined => {
    if (!("node" in point)) return point
    const live = ids.get(point.node)
    if (live !== undefined) return { ...point, node: live }
    const target = emitted.get(point.node)
    if (target === undefined) return undefined
    const { box, geometry } = target.props
    const spot = siteSpot(geometry, box.w, box.h, point.site)
    return { x: Math.round(box.x + spot.x), y: Math.round(box.y + spot.y) }
  }

  const allocated = new Set(create.map(({ node }) => node))
  let at = orderKeyBetween(null, null)
  for (const { part, reused, node } of active) {
    const values = part.props
    const overrides = reused === undefined ? [] : (restored?.get(node) ?? [])
    const current = doom.nodes.get(node)
    if (reused === undefined) {
      if (allocated.has(node) || (current !== undefined && (current.type !== "shape" || current.parent !== null)))
        return refuse("shape", node, "type")
      allocated.add(node)
      if (current === undefined) writes.push({ node, prop: "type", value: part.type })
    } else if (
      current?.type !== "shape" ||
      (current.parent?.id !== instance.generated && !(current.parent === null && returning?.has(keyString(part.key))))
    ) {
      return refuse("shape", node, "parent")
    }
    const parentBase =
      current?.type === "shape" && current.parent === null ? doom.revs.get(node)?.get("parent") : undefined
    writes.push({
      node,
      prop: "parent",
      value: { id: instance.generated, at },
      ...(parentBase === undefined ? {} : { base: parentBase }),
    })
    if (reused === undefined) {
      writes.push({ node, prop: "name", value: values.name })
      if (current !== undefined) writes.push({ node, prop: "link", value: null })
    }
    writes.push(...overrides.filter(({ prop }) => prop === "name" || prop === "link"))
    at = orderKeyBetween(at, null)
    for (const prop of partProps) {
      let value: unknown = values[prop] ?? null
      if (
        prop === "fills" &&
        reused !== undefined &&
        hasBaselineFill(reused.baseline) &&
        current?.type === "shape" &&
        !overrides.some(({ prop }) => prop === "fills") &&
        !sameValue(current.fills ?? [], reused.baseline.fills)
      )
        continue
      if (prop === "geometry" && values.geometry.kind === "line") {
        const start = end(values.geometry.start)
        const finish = end(values.geometry.end)
        if (start === undefined || finish === undefined) return refuse("shape", node, "geometry")
        value = { ...values.geometry, start, end: finish }
      }
      if (value === null && current === undefined) continue
      const override = overrides.find((write) => write.prop === prop && prop === "fills")
      if (override !== undefined) value = override.value
      const base = doom.revs.get(node)?.get(prop)
      writes.push({ node, prop, value, ...(base === undefined ? {} : { base }) })
    }
  }
  for (const { node, key, baseline } of old.values()) {
    const current = doom.nodes.get(node)
    const discarded = (prop: "fills" | "text" | "name" | "link") =>
      findings.push({ kind: "discarded-override", key, node, prop })
    if (hasBaselineFill(baseline) && !sameValue(propOf(current, "fills") ?? [], baseline.fills)) discarded("fills")
    if (baseline.kind === "text" && propOf(current, "text")?.style !== baseline.style) discarded("text")
    if (propOf(current, "name") !== key.join(" / ")) discarded("name")
    if (propOf(current, "link") !== undefined) discarded("link")
    writes.push({ node, prop: "parent", value: null })
  }
  const previousKeys = new Set(
    [...(previous?.parts ?? []), ...(previous?.suppressed ?? [])].map(({ key }) => keyString(key)),
  )
  const parked = kept.flatMap(({ key }): Write[] => {
    if (previousKeys.has(keyString(key))) return []
    const node = partId(frame, key)
    return propOf(doom.nodes.get(node), "parent") === null ? [{ node, prop: "parent", value: null }] : []
  })
  const saved = saveInstance(
    doom,
    frame,
    {
      ...instance,
      suppressed: kept,
      parts: active.map(({ part, node, baseline }) => ({ key: part.key, node, baseline })),
    },
    writes,
    measure,
    parked,
  )
  if (isRefusal(saved)) return saved
  if (old.size > 0) {
    for (const { line, start, end } of lostBy(doom, writes.concat(saved.filter(({ prop }) => prop === "instance")))) {
      if (start !== null) findings.push({ kind: "freed-end", line, end: "start", target: start })
      if (end !== null) findings.push({ kind: "freed-end", line, end: "end", target: end })
    }
  }
  return { writes: saved, findings }
}

export function placeComponent(
  doom: Doom,
  { id, revision, spec }: ComponentDefinition,
  {
    frame,
    parent,
    box,
    data,
    tokens = {},
    variant = {},
    measure,
  }: Inputs & {
    readonly frame: NodeId
    readonly parent: NonNullable<Props["parent"]>
    readonly box: Props["box"]
    readonly measure: Measure
  },
): readonly Write[] | Refusal {
  const generated = partId(frame, ["root"])
  if (frame === generated || doom.nodes.has(frame) || doom.nodes.has(generated)) return refuse("shape", frame, "type")
  const tree = expandComponent(spec, {
    frame: { x: 0, y: 0, w: box.w, h: box.h },
    data,
    tokens,
    variant,
    measure,
    theme: deckOf(doom).theme,
  })
  if (isRefusal(tree)) return tree
  const create: readonly Write[] = [
    { node: frame, prop: "type", value: "frame" },
    { node: frame, prop: "parent", value: parent },
    { node: frame, prop: "name", value: tree.props.name },
    { node: frame, prop: "box", value: box },
    { node: generated, prop: "type", value: "frame" },
    { node: generated, prop: "parent", value: { id: frame, at: orderKeyBetween(null, null) } },
    { node: generated, prop: "name", value: "Generated" },
  ]
  const placed = join(
    doom,
    frame,
    { component: { id, revision }, generated, data, tokens, variant, suppressed: [] },
    undefined,
    tree,
    create,
    measure,
  )
  return isRefusal(placed) ? placed : placed.writes
}

export function regenerateComponent(
  doom: Doom,
  frame: NodeId,
  patch: ComponentPatch,
  measure: Measure,
  definition?: ComponentDefinition,
): ComponentUpdate | Refusal {
  return updateComponent(doom, frame, patch, measure, definition)
}

export function refreshComponent(
  doom: Doom,
  proposed: Doom,
  frame: NodeId,
  measure: Measure,
): ComponentUpdate | Refusal {
  return updateComponent(doom, frame, {}, measure, undefined, undefined, proposed)
}

function updateComponent(
  doom: Doom,
  frame: NodeId,
  patch: ComponentPatch & Partial<Pick<Instance, "suppressed">>,
  measure: Measure,
  definition?: ComponentDefinition,
  returning?: ReadonlyMap<string, Instance["parts"][number]>,
  restored?: ReadonlyMap<NodeId, readonly Write[]>,
  input: Doom = doom,
): ComponentUpdate | Refusal {
  const root = linked(input, frame)
  if (root === undefined) return refuse("missing", frame, "instance")
  const { instance } = root
  const proposed = { ...instance, ...patch }
  const tree = expandInstance(doom, root, proposed, measure, definition, returning, restored)
  if (isRefusal(tree)) return tree
  return join(doom, frame, proposed, instance, tree, [], measure, returning, restored)
}

export function componentTree(doom: Doom, frame: NodeId, measure: Measure): ComponentTree | Refusal {
  const root = linked(doom, frame)
  if (root === undefined) return refuse("missing", frame, "instance")
  return expandInstance(doom, root, root.instance, measure)
}

function expandInstance(
  doom: Doom,
  { id, instance, box }: InstanceFrame,
  proposed: Inputs,
  measure: Measure,
  definition = resolveComponent(instance.component),
  returning?: ReadonlyMap<string, Instance["parts"][number]>,
  restored?: ReadonlyMap<NodeId, readonly Write[]>,
): ComponentTree | Refusal {
  if (box === undefined) return refuse("shape", id, "box")
  if (
    definition === undefined ||
    definition.id !== instance.component.id ||
    definition.revision !== instance.component.revision
  )
    return refuse("shape", id, "instance")
  const styles = new Map(
    [...instance.parts, ...(returning?.values() ?? [])].flatMap(({ key, node, baseline }) => {
      const current = input.nodes.get(node)
      const text = props.text.read(restored?.get(node)?.find(({ prop }) => prop === "text")?.value)
      if (!isRefusal(text)) return [[keyString(key), text.style] as const]
      return baseline.kind === "text" &&
        current?.type === "shape" &&
        current.text !== undefined &&
        current.text.style !== baseline.style
        ? [[keyString(key), current.text.style] as const]
        : []
    }),
  )
  return expandComponent(definition.spec, {
    frame: { x: 0, y: 0, w: box.w, h: box.h },
    data: proposed.data,
    tokens: proposed.tokens,
    variant: proposed.variant,
    theme: deckOf(input).theme,
    measure,
    styleFor: (key) => styles.get(keyString(key)),
  })
}

export type SuppressionChange = Instance["parts"][number] & {
  readonly rev: Rev
  readonly wasSuppressed: boolean
}

export function restoreComponent(
  doom: Doom,
  frame: NodeId,
  generated: NodeId,
  changes: readonly SuppressionChange[],
  owned: ReadonlySet<Rev>,
  measure: Measure,
  patch: ComponentPatch,
  expired: readonly Instance["suppressed"][number][],
  discarded: ReadonlyMap<string, { readonly part: Instance["parts"][number]; readonly overrides: readonly Write[] }>,
): ComponentUpdate | Refusal {
  const current = linked(doom, frame)?.instance
  if (current?.generated !== generated) return { writes: [], findings: [] }
  const suppressed = new Map(current.suppressed.map((part) => [keyString(part.key), part]))
  const live = new Set(current.parts.map(({ key }) => keyString(key)))
  const returning = new Map<string, Instance["parts"][number]>()
  for (const part of expired) {
    const name = keyString(part.key)
    if (!live.has(name) && !suppressed.has(name)) suppressed.set(name, part)
  }
  let changed = Object.keys(patch).length > 0
  for (const { key, node, baseline, rev, wasSuppressed } of changes) {
    const name = keyString(key)
    const have = suppressed.has(name)
    if (have === wasSuppressed || (!have && !live.has(name))) continue
    const stamp = doom.revs.get(node)
    const writer = stamp?.get("suppression") ?? stamp?.get("parent")
    if (writer !== rev && (writer === undefined || !owned.has(writer))) continue
    if (wasSuppressed) {
      suppressed.set(name, { key, reason: "delete" })
      returning.delete(name)
    } else {
      suppressed.delete(name)
      returning.set(name, { key, node, baseline })
    }
    changed = true
  }
  const overrides = new Map<NodeId, readonly Write[]>()
  for (const [key, discardedPart] of discarded) {
    if (live.has(key) || suppressed.has(key)) continue
    const { part, overrides: saved } = discardedPart
    const stamps = doom.revs.get(part.node)
    const exited = stamps?.get("partExit")
    if (
      exited === undefined ||
      exited !== stamps?.get("parent") ||
      propOf(doom.nodes.get(part.node), "parent") !== null
    )
      continue
    returning.set(key, part)
    overrides.set(part.node, saved)
  }
  return changed
    ? updateComponent(
        doom,
        frame,
        { ...patch, suppressed: [...suppressed.values()] },
        measure,
        undefined,
        returning,
        overrides,
      )
    : { writes: [], findings: [] }
}

export function detachComponent(doom: Doom, frame: NodeId): readonly Write[] | Refusal {
  return linked(doom, frame) === undefined
    ? refuse("missing", frame, "instance")
    : [{ node: frame, prop: "instance", value: null }]
}

export function suppressPart(doom: Doom, frame: NodeId, node: NodeId, measure: Measure): readonly Write[] | Refusal {
  const instance = linked(doom, frame)?.instance
  const part = instance?.parts.find((part) => part.node === node)
  if (instance === undefined || part === undefined) return refuse("missing", node, "parent")
  return saveInstance(
    doom,
    frame,
    {
      ...instance,
      parts: instance.parts.filter((part) => part.node !== node),
      suppressed: [...instance.suppressed, { key: part.key, reason: "delete" }],
    },
    [{ node, prop: "parent", value: null }],
    measure,
  )
}
