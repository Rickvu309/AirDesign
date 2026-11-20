import {
  cloneOf,
  nextElementId,
  readSlideId,
  shapeOf,
  type Box,
  type Register,
  type SlideId,
} from "@airdesign/document"
import { freeShapeId, readSlides } from "@airdesign/pptx"
import { pastedOffset, pastedOver, type Moved, type PasteMode } from "@airdesign/render"
import type { CopyRefusal } from "@/copy/element-copy"
import type { CopyAsked } from "@/element-edit"
import { slideBase } from "@/exported-parts"
import { indexedRegister } from "@/indexed-register"
import type { CopiedLayer, LayerCopy } from "@/layer-clipboard"

type Parts = ReadonlyMap<string, Uint8Array>

export type CopyMade = { readonly copy: LayerCopy | null; readonly refused: readonly CopyRefusal[] }

export function layerCopyOf(deck: string, parts: Parts, register: Register, layers: readonly Moved[]): CopyMade {
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
    copied.push({ source: id, box, rows: [{ source: id, element }, ...(inside ?? [])] })
  }
  return { copy: slide === undefined ? null : { deck, slide, layers: copied }, refused }
}

export function slideIdAt(parts: Parts, register: Register, index: number): SlideId | null {
  const slide = readSlides(slideBase(parts, register))[index]
  return slide === undefined ? null : (readSlideId(slide.slide) ?? null)
}

export type PastePlace = {
  readonly mode: PasteMode
  readonly onto: SlideId
  readonly slide: { readonly width: number; readonly height: number }
  readonly view: Box | null
  readonly selected: readonly Box[]
}

export function pastedCopies(copy: LayerCopy, place: PastePlace): readonly CopyAsked[] {
  const boxes = copy.layers.map((layer) => layer.box)
  const over = place.mode === "over" && place.selected.length > 0
  const { dx, dy } = over ? pastedOver(boxes, place.selected) : pastedOffset(boxes, place.slide, place.view)
  return copy.layers.map((layer) => ({
    id: layer.source,
    box: { ...layer.box, x: layer.box.x + dx, y: layer.box.y + dy },
    onto: place.onto,
    rows: new Map(layer.rows.map((row) => [row.source, row.element])),
  }))
}
