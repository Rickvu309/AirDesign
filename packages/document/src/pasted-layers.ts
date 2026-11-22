import { readMedia, type Media } from "./asset-ref.js"
import type { IndexElement } from "./deck-index.js"
import { shapeOf, type ElementId, type SlideId } from "./element-id.js"
import type { Kind } from "./kinds.js"
import { bytesOf, limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { readFloor } from "./slide-floor.js"

export type PastedLayer = { readonly shape: string; readonly element: IndexElement }

export type PastedLayers = {
  readonly markup: string
  readonly shape: string
  readonly media: readonly Media[]
  readonly layers: readonly PastedLayer[]
}

const roots: Readonly<Record<string, Kind>> = {
  "p:sp": "shape",
  "p:pic": "shape",
  "p:cxnSp": "connector",
  "p:grpSp": "group",
}
const shapeNumber = /^[1-9][0-9]{0,9}$/
const mostMedia = 16
const placeholder = /<p:ph[\s/>]/

export function pastedMedia(index: number): string {
  return `pasted${String(index)}`
}

export function pastedKind(markup: string): Kind | null {
  const tag = /^<(p:sp|p:pic|p:cxnSp|p:grpSp)[\s>]/.exec(markup)?.[1]
  if (tag === undefined || !markup.endsWith(`</${tag}>`)) return null
  return roots[tag] ?? null
}

export function readPasted(raw: unknown, slide: SlideId): PastedLayers | undefined {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["markup", "shape", "media", "layers"])) return undefined
  const { markup, shape } = row
  if (typeof markup !== "string" || bytesOf(markup) > limits.row || pastedKind(markup) === null) return undefined
  if (typeof shape !== "string" || !shapeNumber.test(shape)) return undefined
  if (!Array.isArray(row.media) || row.media.length > mostMedia) return undefined
  if (!Array.isArray(row.layers) || row.layers.length > limits.elements) return undefined
  const media = row.media.map(readMedia)
  const layers = row.layers.map((item) => {
    const layer = record(item)
    if (layer === null || !onlyKeys(layer, ["shape", "element"])) return undefined
    const element = readFloor([layer.element], slide)?.[0]
    return typeof layer.shape === "string" && shapeNumber.test(layer.shape) && element !== undefined
      ? { shape: layer.shape, element }
      : undefined
  })
  if (media.some((each) => each === undefined) || layers.some((each) => each === undefined)) return undefined
  return {
    markup,
    shape,
    media: media.filter((each) => each !== undefined),
    layers: layers.filter((each) => each !== undefined),
  }
}

export function pastedNodes(pasted: PastedLayers | undefined): readonly ElementId[] {
  return (pasted?.layers ?? []).map((layer) => layer.element.node)
}

export function pastedFits(element: IndexElement, pasted: PastedLayers, slide: SlideId): boolean {
  if (pastedKind(pasted.markup) !== element.kind || placeholder.test(pasted.markup)) return false
  const above = new Set<ElementId>([element.node])
  const shapes = new Set<string>([pasted.shape])
  for (const { shape, element: layer } of pasted.layers) {
    if (shapeOf(layer.node).slide !== slide || above.has(layer.node) || shapes.has(shape)) return false
    if (!layer.grouped || layer.group === undefined || !above.has(layer.group)) return false
    above.add(layer.node)
    shapes.add(shape)
  }
  return pasted.layers.length === 0 || element.kind === "group"
}
