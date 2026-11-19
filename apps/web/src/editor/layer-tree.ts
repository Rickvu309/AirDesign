import type { ElementId } from "@airdesign/document"
import type { PanelKind } from "@/design/panel-order"

export type LayerKind = Exclude<PanelKind, "many">

export type LayerFlow = "horizontal" | "vertical"

export type LayerRow = {
  readonly node: ElementId
  readonly parent: ElementId | null
  readonly name: string
  readonly kind: LayerKind
  readonly hidden: boolean
  readonly locked: boolean
  readonly flow?: LayerFlow
}

export type Layer = LayerRow & { readonly layers: readonly Layer[] }

export type ShownLayer = {
  readonly layer: Layer
  readonly depth: number
  readonly open: boolean | null
  readonly dim: boolean
}

export type LayerSide = "above" | "below"

export type LayerDrop = {
  readonly node: ElementId
  readonly before: ElementId | null
  readonly among: readonly ElementId[]
}

export function layerTree(rows: readonly LayerRow[]): readonly Layer[] {
  const known = new Set(rows.map((row) => row.node))
  const under = new Map<ElementId | null, LayerRow[]>()
  for (const row of rows) {
    const parent = row.parent !== null && known.has(row.parent) ? row.parent : null
    under.set(parent, [...(under.get(parent) ?? []), { ...row, parent }])
  }
  const level = (parent: ElementId | null): readonly Layer[] =>
    (under.get(parent) ?? []).toReversed().map((row) => ({ ...row, layers: level(row.node) }))
  return level(null)
}

export function shownLayers(tree: readonly Layer[], open: ReadonlySet<ElementId>): readonly ShownLayer[] {
  const shown: ShownLayer[] = []
  const walk = (layers: readonly Layer[], depth: number, dimmed: boolean) => {
    for (const layer of layers) {
      const opened = layer.layers.length === 0 ? null : open.has(layer.node)
      const dim = dimmed || layer.hidden
      shown.push({ layer, depth, open: opened, dim })
      if (opened === true) walk(layer.layers, depth + 1, dim)
    }
  }
  walk(tree, 0, false)
  return shown
}

function pathTo(tree: readonly Layer[], node: ElementId): readonly Layer[] | null {
  for (const layer of tree) {
    if (layer.node === node) return [layer]
    const inside = pathTo(layer.layers, node)
    if (inside !== null) return [layer, ...inside]
  }
  return null
}

export function openedFor(tree: readonly Layer[], nodes: readonly ElementId[]): ReadonlySet<ElementId> {
  return new Set(nodes.flatMap((node) => (pathTo(tree, node) ?? []).slice(0, -1).map((layer) => layer.node)))
}

export function layersUnder(tree: readonly Layer[], nodes: readonly ElementId[]): ReadonlySet<ElementId> {
  const all = (layers: readonly Layer[]): readonly ElementId[] =>
    layers.flatMap((layer) => [layer.node, ...all(layer.layers)])
  return new Set(nodes.flatMap((node) => all((pathTo(tree, node) ?? []).at(-1)?.layers ?? [])))
}

export function layerRange(shown: readonly ShownLayer[], from: ElementId, to: ElementId): readonly ElementId[] {
  const ids = shown.map((each) => each.layer.node)
  const start = ids.indexOf(from)
  const end = ids.indexOf(to)
  if (start < 0 || end < 0) return [to]
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1)
}

function siblingsOf(tree: readonly Layer[], node: ElementId): readonly Layer[] | null {
  const path = pathTo(tree, node)
  if (path === null) return null
  return path.length === 1 ? tree : (path.at(-2)?.layers ?? null)
}

export function layerDrop(
  tree: readonly Layer[],
  node: ElementId,
  target: ElementId,
  side: LayerSide,
): LayerDrop | null {
  const siblings = siblingsOf(tree, node)
  if (node === target || siblings === null || !siblings.some((layer) => layer.node === target)) return null
  const among = siblings.map((layer) => layer.node).toReversed()
  const rest = among.filter((each) => each !== node)
  const at = rest.indexOf(target) + (side === "above" ? 1 : 0)
  const before = rest[at] ?? null
  const now = among[among.indexOf(node) + 1] ?? null
  return before === now ? null : { node, before, among }
}
