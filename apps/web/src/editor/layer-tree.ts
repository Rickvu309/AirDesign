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
  readonly mask?: true
  readonly flow?: LayerFlow
}

export type Layer = LayerRow & { readonly layers: readonly Layer[]; readonly masked?: true }

export type ShownLayer = {
  readonly layer: Layer
  readonly depth: number
  readonly open: boolean | null
  readonly dim: boolean
}

export type LayerSide = "above" | "below"

export type LayerZone = LayerSide | "inside"

export type LayerPlace = {
  readonly node: ElementId
  readonly parent: ElementId | null
  readonly before: ElementId | null
  readonly mark: readonly [row: ElementId, zone: LayerZone, depth: number]
}

export function layerTree(rows: readonly LayerRow[]): readonly Layer[] {
  const known = new Set(rows.map((row) => row.node))
  const under = new Map<ElementId | null, LayerRow[]>()
  for (const row of rows) {
    const parent = row.parent !== null && known.has(row.parent) ? row.parent : null
    under.set(parent, [...(under.get(parent) ?? []), { ...row, parent }])
  }
  const level = (parent: ElementId | null): readonly Layer[] => {
    let masking = false
    const back = (under.get(parent) ?? []).map((row): Layer => {
      const masked = masking && row.mask !== true
      if (row.mask === true && !row.hidden) masking = true
      return { ...row, layers: level(row.node), ...(masked ? { masked: true as const } : {}) }
    })
    return back.toReversed()
  }
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

function layerOf(tree: readonly Layer[], node: ElementId): Layer | null {
  return pathTo(tree, node)?.at(-1) ?? null
}

function layersIn(tree: readonly Layer[], parent: ElementId | null): readonly Layer[] {
  return parent === null ? tree : (layerOf(tree, parent)?.layers ?? [])
}

export function holdsLayers(layer: Layer): boolean {
  return layer.kind === "group" || layer.kind === "frame"
}

function siblingsBut(tree: readonly Layer[], parent: ElementId | null, node: ElementId): readonly ElementId[] {
  return layersIn(tree, parent)
    .map((layer) => layer.node)
    .filter((each) => each !== node)
}

type Spot = { readonly parent: ElementId | null; readonly before: ElementId | null }

function levelUnder(shown: readonly ShownLayer[], at: number, depth: number | undefined): number {
  const here = shown[at]?.depth ?? 0
  const next = shown[at + 1]?.depth ?? 0
  if (depth === undefined || next >= here) return here
  return Math.min(here, Math.max(next, depth))
}

export function layerPlace(
  tree: readonly Layer[],
  shown: readonly ShownLayer[],
  node: ElementId,
  target: ElementId,
  zone: LayerZone,
  depth?: number,
): LayerPlace | null {
  const path = pathTo(tree, target)
  const at = shown.findIndex((each) => each.layer.node === target)
  const row = shown[at]
  if (path === null || row === undefined || path.some((layer) => layer.node === node)) return null
  const spot = (): { readonly place: Spot; readonly level: number } | null => {
    if (zone === "inside")
      return holdsLayers(row.layer) ? { place: { parent: target, before: null }, level: row.depth } : null
    if (zone === "above") {
      const front = siblingsBut(tree, row.layer.parent, node)
      return { place: { parent: row.layer.parent, before: front[front.indexOf(target) - 1] ?? null }, level: row.depth }
    }
    if (row.open === true) return { place: { parent: target, before: null }, level: row.depth + 1 }
    const level = levelUnder(shown, at, depth)
    const anchor = path[path.length - 1 - (row.depth - level)]
    if (anchor === undefined) return null
    return { place: { parent: anchor.parent, before: anchor.node }, level }
  }
  const found = spot()
  if (found === null) return null
  const { parent, before } = found.place
  const now = layerOf(tree, node)
  if (now === null) return null
  if (now.parent === parent && frontOf(tree, node) === before) return null
  return { node, parent, before, mark: [target, zone, found.level] }
}

export function frontOf(tree: readonly Layer[], node: ElementId): ElementId | null {
  const parent = layerOf(tree, node)?.parent ?? null
  const siblings = layersIn(tree, parent).map((layer) => layer.node)
  return siblings[siblings.indexOf(node) - 1] ?? null
}
