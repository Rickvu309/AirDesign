import {
  lineGeometries,
  nextElementId,
  placeNewBox,
  readSlideId,
  shapeOf,
  stackTarget,
  textOpening,
  type CopiedRows,
  type ElementCommand,
  type StackMove,
  type Box,
  type ElementPatch,
  type ElementId,
  type Geometry,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { applyRoute, freeShapeId, readShapes, readSlides, shapeSiblings } from "@airdesign/pptx"
import { boxOf, type Moved, type PaintBox, type ShapeDrawn } from "@airdesign/render"
import { type RemovalRefusal } from "@/copy/element-copy"
import { type GroupChange } from "@/editor/group-actions"
import { type LayerJoin } from "@/editor/layer-join"
import { slideBase } from "@/editing/exported-parts"
import { framedOf } from "@/editing/frame-boxes"
import { indexedRegister } from "@/editing/indexed-register"

type Parts = ReadonlyMap<string, Uint8Array>

const textLine = 274_320
const shapeShare = 0.2
const lineShare = 0.3

type RoomElement = {
  readonly box: PaintBox | null
  readonly id?: ElementId | null
}

export type SlideRoom = {
  readonly width: number
  readonly height: number
  readonly elements?: readonly RoomElement[]
}

export type LayerSpot = { readonly before: ElementId | null }

export type TextPlace = { readonly x: number; readonly y: number; readonly cx?: number; readonly cy?: number }

export type ElementChange =
  | { readonly change: "text"; readonly index: number; readonly size: SlideRoom; readonly place?: TextPlace }
  | {
      readonly change: "shape"
      readonly geometry: Geometry
      readonly index: number
      readonly size: SlideRoom
      readonly drawn?: ShapeDrawn
    }
  | { readonly change: "remove"; readonly nodes: readonly ElementId[]; readonly emptied?: true }
  | { readonly change: "order"; readonly node: ElementId; readonly move: StackMove | LayerSpot }
  | GroupChange
  | LayerJoin

export function takenBoxes(room: SlideRoom): readonly Box[] {
  return (room.elements ?? []).flatMap((each) => (each.box === null ? [] : [boxOf(each.box)]))
}

function slideAt(parts: Parts, index: number) {
  const slide = readSlides(parts)[index]
  const id = slide === undefined ? undefined : readSlideId(slide.slide)
  return slide === undefined || id === undefined ? null : { id, part: slide.part }
}

export function removalRefusal(parts: Parts, register: Register, node: ElementId): RemovalRefusal | null {
  const base = slideBase(parts, register)
  const { slide, shape } = shapeOf(node)
  const found = readShapes(base).find((each) => each.slide === slide && each.shape === shape)
  if (found === undefined) return null
  const framed = framedOf(indexedRegister(parts, register)).children.has(node)
  if (found.grouped === true && !framed) return "group"
  try {
    applyRoute(base, { name: "remove", part: found.part, shape })
    return null
  } catch (error) {
    return error instanceof Error && error.message === "shape-animated" ? "animated" : null
  }
}

function spotted(among: readonly ElementId[], node: ElementId, spot: LayerSpot) {
  const { before } = spot
  if (before === node || (before !== null && !among.includes(before))) return undefined
  return (among[among.indexOf(node) + 1] ?? null) === before ? undefined : before
}

function orderCommand(base: Parts, change: Extract<ElementChange, { change: "order" }>): SlideCommand | null {
  const among = shapeSiblings(base, change.node)
  if (among === null) return null
  const before =
    typeof change.move === "string"
      ? stackTarget(among, change.node, change.move)
      : spotted(among, change.node, change.move)
  if (before === undefined) return null
  const id = readSlideId(shapeOf(change.node).slide)
  if (id === undefined) return null
  return { slide: "element-order", id, node: change.node, before, among }
}

type Removal = Extract<ElementCommand, { readonly slide: "element-remove" }>

function removeCommand(base: Parts, node: ElementId): Removal | null {
  const { slide, shape } = shapeOf(node)
  const found = readSlides(base).find((each) => each.slide === slide)
  const id = readSlideId(slide)
  if (found === undefined || id === undefined) return null
  try {
    applyRoute(base, { name: "remove", part: found.part, shape })
  } catch {
    return null
  }
  return { slide: "element-remove", id, node }
}

export function removals(
  parts: Parts,
  register: Register,
  nodes: readonly ElementId[],
): { readonly edits: readonly Removal[]; readonly refused: readonly RemovalRefusal[] } {
  const base = slideBase(parts, register)
  const edits: Removal[] = []
  const refused: RemovalRefusal[] = []
  for (const node of nodes) {
    const refusal = removalRefusal(parts, register, node)
    const edit = refusal === null ? removeCommand(base, node) : null
    if (refusal !== null && !refused.includes(refusal)) refused.push(refusal)
    if (edit !== null) edits.push(edit)
  }
  return { edits, refused }
}

export function elementCommand(
  parts: Parts,
  register: Register,
  change: Exclude<ElementChange, GroupChange | LayerJoin | { readonly change: "remove" }>,
): SlideCommand | null {
  const base = slideBase(parts, register)
  if (change.change === "order") return orderCommand(base, change)
  const slide = slideAt(base, change.index)
  if (slide === null) return null
  const node = nextElementId(register, slide.id, freeShapeId(base, slide.part))
  const taken = takenBoxes(change.size)
  if (change.change === "shape") {
    const line = lineGeometries.includes(change.geometry)
    const side = Math.round(change.size.height * shapeShare)
    const wanted = line ? { cx: Math.round(change.size.width * lineShare), cy: 0 } : { cx: side, cy: side }
    const { box, opening } = drawnPlace(change.drawn, wanted, line) ?? { box: placeNewBox(change.size, taken, wanted) }
    const kind = line ? "connector" : "shape"
    const element = {
      node,
      kind,
      value: line ? null : "",
      box,
      grouped: false,
      ...(opening === undefined ? {} : { opening }),
    } as const
    return { slide: "element-add", id: slide.id, element, geometry: change.geometry }
  }
  const { place } = change
  const room = place ?? placeNewBox(change.size, taken)
  const drawn = place?.cx !== undefined && place.cy !== undefined
  const box = { x: room.x, y: room.y, cx: drawn ? place.cx : textLine, cy: drawn ? place.cy : textLine }
  const opening = textOpening(drawn ? "fixed" : "auto-width")
  const element = { node, kind: "shape", value: "", box, grouped: false, opening } as const
  return { slide: "element-add", id: slide.id, element }
}

function drawnPlace(
  drawn: ShapeDrawn | undefined,
  wanted: { readonly cx: number; readonly cy: number },
  line: boolean,
): { readonly box: Box; readonly opening?: ElementPatch } | null {
  if (drawn === undefined) return null
  if ("at" in drawn) return { box: { ...drawn.at, ...wanted } }
  const { x, y, cx, cy, flipH, flipV } = drawn.box
  const box = line ? { x, y, cx, cy } : { x, y, cx: Math.max(1, cx), cy: Math.max(1, cy) }
  const flips = { ...(flipH ? { flipH: { set: true } } : {}), ...(flipV ? { flipV: { set: true } } : {}) }
  return Object.keys(flips).length === 0 ? { box } : { box, opening: { box: flips } }
}

export type CopyAsked = Moved & { readonly onto?: SlideId; readonly rows?: CopiedRows }
