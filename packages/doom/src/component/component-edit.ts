import { componentWrites, deckComponent, returningInstances } from "./deck-component.js"
import { applyBeforeRebuild } from "../apply-edit.js"
import { changingWrites, sameValue } from "../changing-writes.js"
import type { Doom, Landed, Write } from "../doom.js"
import { onDeck, propOf, flows } from "../doom-walk.js"
import { rev, type NodeId, type Rev } from "../ids.js"
import { bytesOf, limits } from "../limits.js"
import { measureWith, type Measure } from "../measure.js"
import { props } from "../props.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { guardInstances, instanceRoots, linkedOwner } from "./instance-ownership.js"
import { refreshComponent } from "./join-instance.js"

export const writesTheme = ({ prop }: Pick<Write, "prop">): boolean => prop === "theme" || prop.startsWith("theme.")

export function changesBoxSize(value: unknown, prior: unknown): boolean {
  const before = props.box.read(prior)
  const after = props.box.read(value)
  return !isRefusal(before) && !isRefusal(after) && (before.w !== after.w || before.h !== after.h)
}

export function changesLabelStyle(value: unknown, prior: unknown): boolean {
  const before = props.text.read(prior)
  const after = props.text.read(value)
  return !isRefusal(before) && !isRefusal(after) && before.style !== after.style
}

type FocusEdit = { readonly node: NodeId; readonly focus: readonly string[] }

type Preview = { readonly view: Doom; readonly roots: readonly NodeId[] }

export function componentEditPreview(
  view: Doom,
  asked: readonly Write[],
  batchStart = view.rev,
  focusEdit?: FocusEdit,
): Preview | null | Refusal {
  const components = componentWrites(view, asked)
  if (
    components.size === 0 &&
    focusEdit === undefined &&
    !asked.some((write) => writesTheme(write) || write.prop === "box" || write.prop === "text")
  )
    return null
  const explicit = new Set(instanceRoots(asked))
  const roots = new Set<NodeId>()
  const sizes = new Set<Write>()
  if (asked.some(writesTheme)) {
    for (const node of view.nodes.values())
      if (node.type === "frame" && node.instance !== undefined && onDeck(view.nodes, node.id)) roots.add(node.id)
  }
  if (components.size > 0) {
    const removed = new Set(
      asked.filter(({ prop, value }) => prop === "parent" && value === null).map(({ node }) => node),
    )
    for (const node of view.nodes.values()) {
      const source = propOf(node, "instance")?.component.node
      if (source !== undefined && components.has(source) && !removed.has(source) && onDeck(view.nodes, node.id))
        roots.add(node.id)
    }
  }
  for (const write of asked) {
    const node = view.nodes.get(write.node)
    if (
      write.prop === "box" &&
      propOf(node, "instance") !== undefined &&
      changesBoxSize(write.value, propOf(node, "box"))
    ) {
      roots.add(write.node)
      sizes.add(write)
    }
    if (write.prop === "text" && changesLabelStyle(write.value, propOf(node, "text"))) {
      const owner = linkedOwner(view.nodes, write.node)
      if (owner !== undefined) roots.add(owner)
    }
  }
  for (const root of explicit) roots.delete(root)
  const focused = focusEdit === undefined ? undefined : propOf(view.nodes.get(focusEdit.node), "instance")
  if (
    focusEdit !== undefined &&
    !explicit.has(focusEdit.node) &&
    focused !== undefined &&
    !sameValue(focused.focus, focusEdit.focus)
  )
    roots.add(focusEdit.node)
  if (roots.size === 0) return null
  const edit: Landed = {
    once: "component-preview",
    author: { kind: "person", id: "component-preview" },
    readBase: view.rev,
    rev: rev(view.rev + 1),
    writes: [
      ...asked.map((write) => {
        const current = view.revs.get(write.node)?.get(write.prop)
        const base = current !== undefined && current > batchStart ? current : (write.base ?? current)
        return base === undefined ? write : { ...write, base }
      }),
      ...[...roots].map((node): Write => ({
        node,
        prop: "instance",
        value:
          focusEdit?.node === node && focused !== undefined
            ? { ...focused, focus: focusEdit.focus }
            : propOf(view.nodes.get(node), "instance"),
      })),
    ],
  }
  const next = applyBeforeRebuild({ ...view, onces: new Map() }, edit)
  if (isRefusal(next)) return next
  const refused = guardInstances(view, next, { ...edit, writes: asked.filter((write) => !sizes.has(write)) }, false)
  if (refused !== undefined) return refused
  for (const root of roots) {
    if (!onDeck(next.nodes, root)) roots.delete(root)
    else if (flows(next, root)) return refuse("shape", root, "box")
  }
  return roots.size === 0 ? null : { view: next, roots: [...roots] }
}

export type ComponentEditSample = {
  readonly view: Doom
  readonly texts: readonly string[]
  readonly measures: readonly Parameters<Measure>[]
}
const estimate = measureWith({})

export function sampleComponentEdit(
  view: Doom,
  writes: readonly Write[],
  batchStart?: Rev,
  focusEdit?: FocusEdit,
): ComponentEditSample | null | Refusal {
  const preview = componentEditPreview(view, changingWrites(view, writes), batchStart, focusEdit)
  if (preview === null || isRefusal(preview)) return preview
  const texts = new Set<string>()
  const measures: Parameters<Measure>[] = []
  for (const root of preview.roots) {
    const sample = refreshComponent(view, preview.view, root, (text, theme, width, fit) => {
      measures.push([text, theme, width, fit])
      texts.add(text.chars)
      if (theme.textStyles[text.style].case === "upper") texts.add(text.chars.toUpperCase())
      return estimate(text, theme, width, fit)
    })
    if (isRefusal(sample)) return sample
  }
  return { view: preview.view, texts: [...texts], measures }
}

export function prepareComponentEdit(
  view: Doom,
  writes: readonly Write[],
  measure: Measure,
  batchStart?: Rev,
  focusEdit?: FocusEdit,
): readonly Write[] | Refusal {
  const asked = changingWrites(view, writes)
  const preview = componentEditPreview(view, asked, batchStart, focusEdit)
  if (preview === null) return writes
  if (isRefusal(preview)) return preview
  const generated = new Map<string, Write>()
  const cell = ({ node, prop }: Write) => `${node}\u0000${prop}`
  for (const root of preview.roots) {
    const update = refreshComponent(view, preview.view, root, measure)
    if (isRefusal(update)) return update
    const marker: Write = { node: root, prop: "instance", value: propOf(view.nodes.get(root), "instance") }
    generated.set(cell(marker), marker)
    for (const write of update.writes) generated.set(cell(write), write)
  }
  const prepared = [...asked.filter((write) => !generated.has(cell(write))), ...generated.values()]
  return bytesOf(JSON.stringify(prepared)) >= limits.body - limits.form ? refuse("limit") : prepared
}

export function withCurrentComponents(
  view: Doom,
  asked: readonly Write[],
  measure: Measure,
): readonly Write[] | Refusal {
  const writes = withRisingRevisions(view, asked)
  const returning = returningInstances(view, writes)
  if (returning.length === 0) return writes
  const next = applyBeforeRebuild(
    { ...view, onces: new Map() },
    {
      once: "returning",
      author: { kind: "person", id: "returning" },
      readBase: view.rev,
      rev: rev(view.rev + 1),
      writes,
    },
  )
  if (isRefusal(next)) return next
  const stale = returning.filter((root) => {
    const instance = propOf(next.nodes.get(root), "instance")
    const source = instance?.component.node
    return source !== undefined && deckComponent(next, source)?.revision !== instance?.component.revision
  })
  if (stale.length === 0) return writes
  const generated = new Map<string, Write>()
  const cell = ({ node, prop }: Write) => `${node}\u0000${prop}`
  for (const root of stale) {
    const update = refreshComponent(view, next, root, measure)
    const detach: Write = { node: root, prop: "instance", value: null }
    for (const write of isRefusal(update) ? [detach] : update.writes) generated.set(cell(write), write)
  }
  return [...writes.filter((write) => !generated.has(cell(write))), ...generated.values()]
}

function withRisingRevisions(fold: Pick<Doom, "nodes">, writes: readonly Write[]): readonly Write[] {
  const raised = new Map<NodeId, { readonly from: number; readonly to: number }>()
  for (const { node, prop, value } of writes) {
    const current = fold.nodes.get(node)
    if (prop !== "revision" || current?.type !== "component" || current.revision === undefined) continue
    if (typeof value === "number" && value <= current.revision)
      raised.set(node, { from: value, to: current.revision + 1 })
  }
  if (raised.size === 0) return writes
  return writes.map((write) => {
    const revision = raised.get(write.node)?.to
    if (write.prop === "revision" && revision !== undefined) return { ...write, value: revision }
    if (write.prop !== "instance") return write
    const instance = props.instance.read(write.value)
    if (isRefusal(instance) || instance.component.node === undefined) return write
    const moved = raised.get(instance.component.node)
    if (moved === undefined || moved.from !== instance.component.revision) return write
    const component = { node: instance.component.node, revision: moved.to }
    return { ...write, value: { ...(write.value as object), component } }
  })
}
