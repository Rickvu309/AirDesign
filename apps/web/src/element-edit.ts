import {
  elementsUndoable,
  lineGeometries,
  nextElementId,
  openingTable,
  placeNewBox,
  writeTableValue,
  readSlideId,
  shapeOf,
  slideUndoable,
  stackTarget,
  type ElementCommand,
  type StackMove,
  type Box,
  type ElementId,
  type Geometry,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { applyRoute, freeShapeId, paintKind, readShapes, readSlides, shapeSiblings } from "@airdesign/pptx"
import { boxOf, type PaintBox } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { elementCopy, type RemovalRefusal } from "@/copy/element-copy"
import { commitGroup, type GroupChange } from "@/editor/group-actions"
import { slideBase } from "@/exported-parts"
import { framedOf } from "@/frame-boxes"
import { indexedRegister } from "@/indexed-register"
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

export type TableSize = { readonly rows: number; readonly columns: number }

export type LayerSpot = { readonly before: ElementId | null }

export type ElementChange =
  | { readonly change: "text"; readonly index: number; readonly size: SlideRoom }
  | ({ readonly change: "table"; readonly index: number; readonly size: SlideRoom } & TableSize)
  | { readonly change: "shape"; readonly geometry: Geometry; readonly index: number; readonly size: SlideRoom }
  | { readonly change: "remove"; readonly nodes: readonly ElementId[] }
  | { readonly change: "order"; readonly node: ElementId; readonly move: StackMove | LayerSpot }
  | GroupChange

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
  if ((found.grouped === true && !framed) || paintKind(found.kind) === "group") return "group"
  try {
    applyRoute(base, { name: "remove", part: found.part, shape })
    return null
  } catch (error) {
    return error instanceof Error && error.message === "shape-animated" ? "animated" : null
  }
}

function spotted(among: readonly ElementId[], change: { readonly node: ElementId; readonly move: LayerSpot }) {
  const { before } = change.move
  if (before === change.node || (before !== null && !among.includes(before))) return undefined
  return (among[among.indexOf(change.node) + 1] ?? null) === before ? undefined : before
}

function orderCommand(base: Parts, change: Extract<ElementChange, { change: "order" }>): SlideCommand | null {
  const among = shapeSiblings(base, change.node)
  if (among === null) return null
  const before = typeof change.move === "string" ? stackTarget(among, change.node, change.move) : spotted(among, change)
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
  change: Exclude<ElementChange, GroupChange | { readonly change: "remove" }>,
): SlideCommand | null {
  const base = slideBase(parts, register)
  if (change.change === "order") return orderCommand(base, change)
  const slide = slideAt(base, change.index)
  if (slide === null) return null
  const node = nextElementId(register, slide.id, freeShapeId(base, slide.part))
  const taken = takenBoxes(change.size)
  if (change.change === "table") {
    const size = { cx: Math.round(change.size.width * 0.6), cy: change.rows * tableRow }
    const box = placeNewBox(change.size, taken, size)
    const value = writeTableValue(openingTable(change.rows, change.columns))
    return { slide: "element-add", id: slide.id, element: { node, kind: "table", value, box, grouped: false } }
  }
  if (change.change === "shape") {
    const line = lineGeometries.includes(change.geometry)
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
  if (change.change === "group" || change.change === "ungroup" || change.change === "frame")
    return commitGroup(deckId, parts, register, change, paint)
  if (change.change === "remove") return commitRemovals(deckId, parts, register, change.nodes, paint)
  const edit = elementCommand(parts, register, change)
  if (edit === null) return "refused"
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(edit.slide === "element-add" ? edit.element.node : null, undoable)
  return flushPending(connect, deckId)
}

async function commitRemovals(
  deckId: string,
  parts: Parts,
  register: Register,
  nodes: readonly ElementId[],
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const { edits, refused } = removals(parts, register, nodes)
  for (const refusal of refused)
    toast.error(elementCopy.removeRefusedTitle, {
      id: `remove-refused-${refusal}`,
      description: elementCopy.removeRefusedBody[refusal],
    })
  const file = fileSlides(parts, register)
  const went: Removal[] = []
  for (const edit of edits) if ((await connect(memoryRemote()).enqueueSlide(deckId, file, edit)).ok) went.push(edit)
  if (went.length === 0) return "refused"
  await paint(null, elementsUndoable(register, file, went))
  return flushPending(connect, deckId)
}
