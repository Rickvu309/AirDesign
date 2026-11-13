import {
  nextElementId,
  openingTable,
  placeNewBox,
  writeTableValue,
  readSlideId,
  shapeOf,
  slideUndoable,
  type Box,
  type ElementId,
  type Geometry,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { applyRoute, freeShapeId, paintKind, readShapes, readSlides } from "@airdesign/pptx"
import { boxOf, type PaintBox } from "@airdesign/render"
import { toast } from "sonner"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { elementCopy, type RemovalRefusal } from "@/copy/element-copy"
import { slideBase } from "@/exported-parts"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

const tableRow = 370840
const shapeShare = 0.2
const lineShare = 0.3

export type SlideRoom = {
  readonly width: number
  readonly height: number
  readonly elements?: readonly { readonly box: PaintBox | null }[]
}

export type ElementChange =
  | { readonly change: "text" | "table"; readonly index: number; readonly size: SlideRoom }
  | { readonly change: "shape"; readonly geometry: Geometry; readonly index: number; readonly size: SlideRoom }
  | { readonly change: "remove"; readonly node: ElementId }

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
  if (found.grouped === true || paintKind(found.kind) === "group") return "group"
  try {
    applyRoute(base, { name: "remove", part: found.part, shape })
    return null
  } catch (error) {
    return error instanceof Error && error.message === "shape-animated" ? "animated" : null
  }
}

export function elementCommand(parts: Parts, register: Register, change: ElementChange): SlideCommand | null {
  const base = slideBase(parts, register)
  if (change.change === "remove") {
    const { slide, shape } = shapeOf(change.node)
    const found = readSlides(base).find((each) => each.slide === slide)
    const id = readSlideId(slide)
    if (found === undefined || id === undefined) return null
    try {
      applyRoute(base, { name: "remove", part: found.part, shape })
    } catch {
      return null
    }
    return { slide: "element-remove", id, node: change.node }
  }
  const slide = slideAt(base, change.index)
  if (slide === null) return null
  const node = nextElementId(register, slide.id, freeShapeId(base, slide.part))
  const taken = takenBoxes(change.size)
  if (change.change === "table") {
    const size = { cx: Math.round(change.size.width * 0.6), cy: 3 * tableRow }
    const box = placeNewBox(change.size, taken, size)
    const value = writeTableValue(openingTable(3, 3))
    return { slide: "element-add", id: slide.id, element: { node, kind: "table", value, box, grouped: false } }
  }
  if (change.change === "shape") {
    const line = change.geometry === "line"
    const side = Math.round(change.size.height * shapeShare)
    const wanted = line ? { cx: Math.round(change.size.width * lineShare), cy: 0 } : { cx: side, cy: side }
    const box = placeNewBox(change.size, taken, wanted)
    const kind = line ? "connector" : "shape"
    const element = { node, kind, value: null, box, grouped: false } as const
    return { slide: "element-add", id: slide.id, element, geometry: change.geometry }
  }
  const box = placeNewBox(change.size, taken)
  return { slide: "element-add", id: slide.id, element: { node, kind: "shape", value: "", box, grouped: false } }
}

export async function commitElement(
  deckId: string,
  parts: Parts,
  register: Register,
  change: ElementChange,
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const refusal = change.change === "remove" ? removalRefusal(parts, register, change.node) : null
  if (refusal !== null) {
    toast.error(elementCopy.removeRefusedTitle, { description: elementCopy.removeRefusedBody[refusal] })
    return "refused"
  }
  const edit = elementCommand(parts, register, change)
  if (edit === null) return "refused"
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(edit.slide === "element-add" ? edit.element.node : null, undoable)
  return flushPending(connect, deckId)
}
