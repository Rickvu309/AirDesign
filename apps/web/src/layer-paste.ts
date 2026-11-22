import {
  cloneOf,
  decide,
  elementId,
  nextElementId,
  readSlideId,
  shapeOf,
  type Box,
  type ElementId,
  type IndexElement,
  type Media,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { carriedShape, freeShapeId, readSlides } from "@airdesign/pptx"
import { pastedOffset, pastedOver, type Moved, type PasteMode } from "@airdesign/render"
import type { CopyRefusal, ElsewhereRefusal } from "@/copy/element-copy"
import type { CopyAsked } from "@/element-edit"
import { slideBase } from "@/editing/exported-parts"
import { indexedRegister } from "@/editing/indexed-register"
import { base64Of, type CarriedLayer, type CopiedLayer, type LayerCopy } from "@/editing/layer-clipboard"
import { fileSlides } from "@/editing/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

export type CopyMade = { readonly copy: LayerCopy | null; readonly refused: readonly CopyRefusal[] }

function carriedOf(display: Parts, part: string, id: ElementId, framed: boolean): CarriedLayer | undefined {
  if (framed) return undefined
  try {
    const carried = carriedShape(display, part, shapeOf(id).shape)
    if (carried === null) return undefined
    const images = carried.images.map((image) => ({ type: image.type, data: base64Of(image.bytes) }))
    return { markup: carried.markup, images }
  } catch {
    return undefined
  }
}

export function layerCopyOf(
  deck: string,
  parts: Parts,
  display: Parts,
  register: Register,
  layers: readonly Moved[],
): CopyMade {
  const base = slideBase(parts, register)
  const slides = readSlides(base)
  const indexed = indexedRegister(parts, register)
  const copied: CopiedLayer[] = []
  const refused: CopyRefusal[] = []
  let slide: SlideId | undefined
  for (const { id, box } of layers) {
    const found = slides.find((each) => each.slide === shapeOf(id).slide)
    const own = found === undefined ? undefined : readSlideId(found.slide)
    if (found === undefined || own === undefined || (slide !== undefined && own !== slide)) continue
    const made = cloneOf(indexed, id, nextElementId(indexed, own, freeShapeId(base, found.part)), box)
    if (!made.ok) {
      if (made.refusal !== "dead" && !refused.includes(made.refusal)) refused.push(made.refusal)
      continue
    }
    slide = own
    const { element, layers: inside } = made.command
    const rows = [{ source: id, element }, ...(inside ?? [])]
    const carried = carriedOf(
      display,
      found.part,
      id,
      rows.some((row) => row.element.framing !== undefined),
    )
    copied.push({ source: id, box, rows, ...(carried === undefined ? {} : { carried }) })
  }
  return { copy: slide === undefined ? null : { deck, slide, layers: copied }, refused }
}

export function slideIdAt(parts: Parts, register: Register, index: number): SlideId | null {
  const slide = readSlides(slideBase(parts, register))[index]
  return slide === undefined ? null : (readSlideId(slide.slide) ?? null)
}

export type PastePlace = {
  readonly mode: Exclude<PasteMode, "replace">
  readonly onto: SlideId
  readonly slide: { readonly width: number; readonly height: number }
  readonly view: Box | null
  readonly selected: readonly Box[]
}

function offsetOf(copy: LayerCopy, place: PastePlace) {
  const boxes = copy.layers.map((layer) => layer.box)
  const over = place.mode === "over" && place.selected.length > 0
  return over ? pastedOver(boxes, place.selected) : pastedOffset(boxes, place.slide, place.view)
}

export function pastedCopies(copy: LayerCopy, place: PastePlace): readonly CopyAsked[] {
  const { dx, dy } = offsetOf(copy, place)
  return copy.layers.map((layer) => ({
    id: layer.source,
    box: { ...layer.box, x: layer.box.x + dx, y: layer.box.y + dy },
    onto: place.onto,
    rows: new Map(layer.rows.map((row) => [row.source, row.element])),
  }))
}

type Added = Extract<SlideCommand, { readonly slide: "element-add" }>

const laidOut = /<p:ph[\s/>]/

function pastedRow(row: IndexElement, node: ElementId, group: ElementId | undefined): IndexElement {
  const { node: _node, kind, value, box } = row
  return { node, kind, value, box, grouped: group !== undefined, ...(group === undefined ? {} : { group }) }
}

export function pastedAdds(
  parts: Parts,
  register: Register,
  copy: LayerCopy,
  places: readonly PastePlace[],
  media: readonly (readonly Media[])[],
): { readonly edits: readonly Added[]; readonly refused: readonly ElsewhereRefusal[] } {
  const base = slideBase(parts, register)
  const file = fileSlides(parts, register)
  let current = indexedRegister(parts, register)
  const edits: Added[] = []
  const refused: ElsewhereRefusal[] = []
  for (const place of places) {
    const found = readSlides(base).find((each) => each.slide === place.onto)
    if (found === undefined) continue
    const { dx, dy } = offsetOf(copy, place)
    for (const [at, layer] of copy.layers.entries()) {
      const [top, ...inside] = layer.rows
      const reason = layer.carried === undefined ? "carried" : laidOut.test(layer.carried.markup) ? "layout" : null
      if (reason !== null || top === undefined || layer.carried === undefined) {
        if (reason !== null && !refused.includes(reason)) refused.push(reason)
        continue
      }
      const first = Number(shapeOf(nextElementId(current, place.onto, freeShapeId(base, found.part))).shape)
      const nodes = new Map(
        layer.rows.map((row, index) => [row.element.node, elementId(`${place.onto}.${String(first + index)}`)]),
      )
      const node = nodes.get(top.element.node)
      if (node === undefined) continue
      const box = { ...layer.box, x: layer.box.x + dx, y: layer.box.y + dy }
      const layers = inside.flatMap((row) => {
        const own = nodes.get(row.element.node)
        const group = row.element.group === undefined ? undefined : nodes.get(row.element.group)
        return own === undefined || group === undefined
          ? []
          : [{ shape: shapeOf(row.source).shape, element: pastedRow(row.element, own, group) }]
      })
      const pasted = {
        markup: layer.carried.markup,
        shape: shapeOf(layer.source).shape,
        media: media[at] ?? [],
        layers,
      }
      const edit: Added = {
        slide: "element-add",
        id: place.onto,
        element: { ...pastedRow(top.element, node, undefined), box },
        pasted,
      }
      const decision = decide(current, { command: "slide", file, edit })
      if (decision.decision !== "apply") {
        if (!refused.includes("carried")) refused.push("carried")
        continue
      }
      current = decision.register
      edits.push(edit)
    }
  }
  return { edits, refused }
}
