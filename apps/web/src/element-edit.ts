import {
  nextElementId,
  openingTable,
  writeTableValue,
  type Box,
  readSlideId,
  shapeOf,
  slideUndoable,
  type ElementId,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { applyRoute, freeShapeId, readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { clearSpot } from "@/clear-spot"
import { slideBase } from "@/exported-parts"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

const tableRow = 370840

export type ElementChange =
  | {
      readonly change: "text"
      readonly index: number
      readonly size: { readonly width: number; readonly height: number }
    }
  | { readonly change: "remove"; readonly node: ElementId }
  | {
      readonly change: "table"
      readonly index: number
      readonly size: { readonly width: number; readonly height: number }
      readonly taken: readonly Box[]
    }

function slideAt(parts: Parts, index: number) {
  const slide = readSlides(parts)[index]
  const id = slide === undefined ? undefined : readSlideId(slide.slide)
  return slide === undefined || id === undefined ? null : { id, part: slide.part }
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
  if (change.change === "table") {
    const box = clearSpot(change.size, change.taken, { cx: Math.round(change.size.width * 0.6), cy: 3 * tableRow })
    const value = writeTableValue(openingTable(3, 3))
    return { slide: "element-add", id: slide.id, element: { node, kind: "table", value, box, grouped: false } }
  }
  const cx = Math.round(change.size.width * 0.4)
  const cy = Math.round(change.size.height * 0.12)
  const box = { x: Math.round((change.size.width - cx) / 2), y: Math.round((change.size.height - cy) / 2), cx, cy }
  return { slide: "element-add", id: slide.id, element: { node, kind: "shape", value: "", box, grouped: false } }
}

export async function commitElement(
  deckId: string,
  parts: Parts,
  register: Register,
  change: ElementChange,
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const edit = elementCommand(parts, register, change)
  if (edit === null) return "refused"
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(edit.slide === "element-add" ? edit.element.node : null, undoable)
  return flushPending(connect, deckId)
}
