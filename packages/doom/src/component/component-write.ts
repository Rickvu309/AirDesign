import type { Doom, Write } from "../doom.js"
import { deckOf } from "../deck-of.js"
import { childrenOf, deckOf as deckNodeOf, onDeck, parentOf, propOf } from "../doom-walk.js"
import { readNodeId, type NodeId } from "../ids.js"
import { bytesOf, limits } from "../limits.js"
import type { Measure } from "../measure.js"
import { orderKeyBetween } from "../order-key.js"
import { reject } from "../read-kit.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { changingWrites } from "../changing-writes.js"
import { componentEditPreview, rebuildRoots, unchangedSpec } from "./component-edit.js"
import { deckComponent } from "./deck-component.js"
import { expandComponent } from "./expand-component.js"
import type { ComponentFinding } from "./findings.js"
import type { ComponentTree } from "./nodes.js"
import { refreshComponent } from "./join-instance.js"
import { componentSpec } from "./library.js"
import { type ComponentSpec, readComponentSpec } from "./spec.js"
import { specBytes } from "./stored-spec.js"
import type { Charge } from "./values.js"

const editWork = 400_000

export type ComponentWriteFinding = ComponentFinding & { readonly where: NodeId | "sample" }

export type ComponentWrite = {
  readonly component: NodeId
  readonly revision: number
  readonly writes: readonly Write[]
  readonly rebuilt: readonly NodeId[]
  readonly findings: readonly ComponentWriteFinding[]
}

type Current = { readonly node: NodeId; readonly revision: number; readonly name: unknown; readonly sample: unknown }

const recordOf = (raw: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined

const joined = (prefix: string, field: string | undefined): string =>
  field === undefined || field === "$" ? prefix : field.startsWith("[") ? `${prefix}${field}` : `${prefix}.${field}`

function sampleField(field: string | undefined): string {
  if (field?.startsWith("data") === true) return joined("spec.sample", field)
  if (field?.startsWith("frame") === true) return "spec.sample"
  return joined("spec", field)
}

function stated({ fault, form = "A value allowed by the component grammar." }: Refusal): string {
  if (fault === "missing") return `Missing. Needs ${form.charAt(0).toLowerCase()}${form.slice(1)}`
  if (fault === "unknown") return `Unknown field. ${form}`
  return form
}

function currentComponent(fold: Doom, target: string): Current | Refusal {
  if (componentSpec(target) !== undefined)
    return {
      refused: "shape",
      field: "target",
      form: `${target} is built in and cannot be changed. Add a new component, starting from its spec.`,
    }
  const node = readNodeId(target)
  const found = node === undefined ? undefined : deckComponent(fold, node)
  if (node === undefined || found === undefined)
    return { refused: "missing", field: "target", form: `No component ${target}.` }
  const stored = fold.nodes.get(node)
  return {
    node,
    revision: found.revision,
    name: propOf(stored, "name"),
    sample: recordOf(propOf(stored, "spec"))?.sample,
  }
}

function editBudget(): { readonly charge: Charge; readonly spent: () => boolean } {
  let left = editWork
  let spent = false
  return {
    charge: (cost = 1) => {
      left -= cost
      if (left >= 0) return
      spent = true
      reject("limit", `One edit may use at most ${editWork} work units.`)
    },
    spent: () => spent,
  }
}

function created(fold: Doom, node: NodeId, name: string, spec: unknown): readonly Write[] | Refusal {
  const deck = deckNodeOf(fold)?.id
  if (deck === undefined) return refuse("missing")
  const last = childrenOf(fold, deck).at(-1)
  return [
    { node, prop: "type", value: "component" },
    { node, prop: "parent", value: { id: deck, at: orderKeyBetween(parentOf(last)?.at ?? null, null) } },
    { node, prop: "name", value: name },
    { node, prop: "spec", value: spec },
    { node, prop: "revision", value: 1 },
  ]
}

type Read = {
  readonly spec: ComponentSpec
  readonly frame: { readonly x: 0; readonly y: 0; readonly w: number; readonly h: number }
  readonly data: unknown
  readonly stored: unknown
}

function readWritten(raw: unknown, current: Current | undefined): Read | Refusal {
  const given = recordOf(raw)
  const spec =
    given !== undefined && given.sample === undefined && current?.sample !== undefined
      ? { ...given, sample: current.sample }
      : raw
  const encoded = JSON.stringify(spec) as string | undefined
  const bytes = encoded === undefined ? 0 : bytesOf(encoded)
  if (bytes > specBytes)
    return {
      refused: "limit",
      field: "spec",
      form: `A spec holds at most ${specBytes} bytes of JSON; this one has ${bytes}.`,
    }
  const read = readComponentSpec(spec)
  if (isRefusal(read)) return { ...read, field: joined("spec", read.field) }
  const sample = recordOf(recordOf(spec)?.sample)
  if (read.sample === undefined || sample === undefined || encoded === undefined)
    return {
      refused: "shape",
      field: "spec.sample",
      fault: "missing",
      form: "{w, h, data}: a frame size and data that expand cleanly.",
    }
  const { w, h } = read.sample
  return { spec: read, frame: { x: 0, y: 0, w, h }, data: sample.data, stored: JSON.parse(encoded) }
}

function specWrites(fold: Doom, node: NodeId, current: Current | undefined, { spec, stored }: Read) {
  if (current === undefined) return created(fold, node, spec.name, stored)
  const changed = (prop: "spec" | "revision" | "name", value: unknown): Write => {
    const base = fold.revs.get(node)?.get(prop)
    return { node, prop, value, ...(base === undefined ? {} : { base }) }
  }
  return [
    changed("spec", stored),
    changed("revision", current.revision + 1),
    ...(current.name === spec.name ? [] : [changed("name", spec.name)]),
  ]
}

export type ComponentSpecWrite = Omit<ComponentWrite, "rebuilt">

export function prepareComponentSpec(
  fold: Doom,
  asked: { readonly spec: unknown; readonly target?: string | undefined },
  measure: Measure,
  mint: () => NodeId,
  charge: Charge = editBudget().charge,
): ComponentSpecWrite | Refusal {
  const current = asked.target === undefined ? undefined : currentComponent(fold, asked.target)
  if (isRefusal(current)) return current
  const read = readWritten(asked.spec, current)
  if (isRefusal(read)) return read
  const { spec, frame, data } = read
  const theme = deckOf(fold).theme
  const tree = expandComponent(spec, { data, frame, theme, measure, work: charge })
  if (isRefusal(tree))
    return { refused: tree.refused, field: sampleField(tree.field), form: `Expanding the sample: ${stated(tree)}` }
  const node = current?.node ?? mint()
  const revision = (current?.revision ?? 0) + 1
  const writes = specWrites(fold, node, current, read)
  if (isRefusal(writes)) return writes
  const unchanged = unchangedSpec(fold, changingWrites(fold, writes))
  if (unchanged !== undefined) return unchanged
  const findings = tree.findings.map((finding): ComponentWriteFinding => ({ ...finding, where: "sample" }))
  return { component: node, revision, writes, findings }
}

type Budget = ReturnType<typeof editBudget>

function rebuiltOrRefused(
  base: Doom,
  view: Doom,
  root: NodeId,
  component: NodeId,
  instances: number,
  measure: Measure,
  work: Budget,
) {
  const rebuilt = refreshComponent(base, view, root, measure, work.charge)
  if (!isRefusal(rebuilt)) return rebuilt
  if (work.spent())
    return overBudget(
      component,
      `Updating ${component} would rebuild ${instances} instances, more work than one edit allows. Detach or delete some instances, or make the spec cheaper.`,
    )
  if (rebuilt.node !== undefined) return rebuilt
  return {
    refused: rebuilt.refused,
    node: root,
    prop: "instance",
    ...(rebuilt.field === undefined ? {} : { field: rebuilt.field }),
    form: `Layer ${root} cannot expand with component ${component}: ${stated(rebuilt)}`,
  } satisfies Refusal
}

const overBudget = (node: NodeId, form: string): Refusal => ({
  refused: "limit",
  node,
  prop: "spec",
  field: "spec",
  form,
})

const tooLarge = (node: NodeId, instances: number) =>
  overBudget(
    node,
    `Updating ${node} would rebuild ${instances} instances, more than one edit can carry. Detach or delete some instances, or make the spec smaller.`,
  )

export function prepareComponentWrite(
  fold: Doom,
  asked: { readonly spec: unknown; readonly target?: string },
  measure: Measure,
  mint: () => NodeId,
): ComponentWrite | Refusal {
  const work = editBudget()
  const made = prepareComponentSpec(fold, asked, measure, mint, work.charge)
  if (isRefusal(made)) return made
  const { component: node, revision, writes } = made
  const findings = [...made.findings]
  const preview = componentEditPreview(fold, writes)
  if (isRefusal(preview)) return preview
  if (preview === null) return { component: node, revision, writes, rebuilt: [], findings }
  const instances = preview.roots.length
  const prepared = rebuildRoots(fold, writes, preview, (root) => {
    const rebuilt = rebuiltOrRefused(fold, preview.view, root, node, instances, measure, work)
    if (!isRefusal(rebuilt)) findings.push(...rebuilt.tree.findings.map((finding) => ({ ...finding, where: root })))
    return rebuilt
  })
  if (isRefusal(prepared)) return prepared
  if (bytesOf(JSON.stringify(prepared)) >= limits.body - limits.form) return tooLarge(node, instances)
  return { component: node, revision, writes: prepared, rebuilt: preview.roots, findings }
}

export function staleInstances(view: Doom, components: ReadonlySet<NodeId>): readonly NodeId[] {
  const stale: NodeId[] = []
  for (const node of view.nodes.values()) {
    const linked = propOf(node, "instance")?.component
    if (linked?.node === undefined || !components.has(linked.node) || !onDeck(view.nodes, node.id)) continue
    if (deckComponent(view, linked.node)?.revision !== linked.revision) stale.push(node.id)
  }
  return stale
}

export type StaleRebuild = { readonly writes: readonly Write[] } | (Refusal & { readonly component: NodeId })

export function rebuildStaleInstances(view: Doom, components: readonly NodeId[], measure: Measure): StaleRebuild {
  const work = editBudget()
  const writes: Write[] = []
  for (const component of components) {
    const roots = staleInstances(view, new Set([component]))
    for (const root of roots) {
      const rebuilt = rebuiltOrRefused(view, view, root, component, roots.length, measure, work)
      if (isRefusal(rebuilt)) return { ...rebuilt, component }
      writes.push(...rebuilt.update.writes)
    }
    if (bytesOf(JSON.stringify(writes)) >= limits.body - limits.form)
      return { ...tooLarge(component, roots.length), component }
  }
  return { writes }
}

export function componentSampleTree(fold: Doom, id: NodeId, measure: Measure): ComponentTree | Refusal {
  const found = deckComponent(fold, id)
  if (found?.spec.sample === undefined) return refuse("missing", id, "spec")
  const { w, h, data } = found.spec.sample
  return expandComponent(found.spec, { data, frame: { x: 0, y: 0, w, h }, theme: deckOf(fold).theme, measure })
}
