import {
  cloneOf,
  decide,
  elementsUndoable,
  lineGeometries,
  nextElementId,
  openingTable,
  openingTableSize,
  placeNewBox,
  writeTableValue,
  readSlideId,
  shapeOf,
  slideUndoable,
  stackTarget,
  swapUndoable,
  type CopiedRows,
  type ElementClone,
  type ElementCommand,
  type StackMove,
  type Box,
  type ElementId,
  type Geometry,
  type Register,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { applyRoute, freeShapeId, readShapes, readSlides, shapeSiblings } from "@airdesign/pptx"
import { boxOf, type Copied, type Moved, type PaintBox } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { elementCopy, type CopyRefusal, type RemovalRefusal } from "@/copy/element-copy"
import { commitGroup, type GroupChange } from "@/editor/group-actions"
import { commitJoin, type LayerJoin } from "@/editor/layer-join"
import { slideBase } from "@/exported-parts"
import { framedOf } from "@/frame-boxes"
import { indexedRegister } from "@/indexed-register"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

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
  if (change.change === "table") {
    const box = placeNewBox(change.size, taken, openingTableSize(change.size.width, change.rows))
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
  if (
    change.change === "group" ||
    change.change === "ungroup" ||
    change.change === "frame" ||
    change.change === "plain-frame" ||
    change.change === "mask"
  )
    return commitGroup(deckId, parts, register, change, paint)
  if (change.change === "remove") return commitRemovals(deckId, parts, register, change.nodes, paint)
  if (change.change === "join") return commitJoin(deckId, parts, register, change, paint)
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
    toast.refusal(elementCopy.removeRefusedTitle, {
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

export type CopyAsked = Moved & { readonly onto?: SlideId; readonly rows?: CopiedRows }

export function copyCommands(
  parts: Parts,
  register: Register,
  copies: readonly CopyAsked[],
): { readonly edits: readonly ElementClone[]; readonly refused: readonly CopyRefusal[] } {
  const base = slideBase(parts, register)
  const slides = readSlides(base)
  const file = fileSlides(parts, register)
  let current = indexedRegister(parts, register)
  const edits: ElementClone[] = []
  const refused: CopyRefusal[] = []
  for (const { id: source, box, onto, rows } of copies) {
    const found = slides.find((each) => each.slide === (onto ?? shapeOf(source).slide))
    const slide = found === undefined ? undefined : readSlideId(found.slide)
    if (found === undefined || slide === undefined) continue
    const node = nextElementId(current, slide, freeShapeId(base, found.part))
    const cloned = cloneOf(current, source, node, box, rows)
    if (!cloned.ok) {
      if (cloned.refusal !== "dead" && !refused.includes(cloned.refusal)) refused.push(cloned.refusal)
      continue
    }
    const decision = decide(current, { command: "slide", file, edit: cloned.command })
    if (decision.decision !== "apply") continue
    current = decision.register
    edits.push(cloned.command)
  }
  return { edits, refused }
}

type Born = ElementClone | Extract<ElementCommand, { readonly slide: "element-add" }>

export async function replacedUndoable(
  deckId: string,
  parts: Parts,
  register: Register,
  added: readonly Born[],
  replacing: readonly ElementId[],
): Promise<Undoable | null> {
  const file = fileSlides(parts, register)
  if (replacing.length === 0) return elementsUndoable(register, file, added)
  const { edits, refused } = removals(parts, register, replacing)
  for (const refusal of refused)
    toast.refusal(elementCopy.removeRefusedTitle, {
      id: `remove-refused-${refusal}`,
      description: elementCopy.removeRefusedBody[refusal],
    })
  const gone: Removal[] = []
  for (const edit of edits) if ((await connect(memoryRemote()).enqueueSlide(deckId, file, edit)).ok) gone.push(edit)
  return swapUndoable(register, file, added, gone)
}

export async function commitCopies(
  deckId: string,
  parts: Parts,
  register: Register,
  copies: readonly CopyAsked[],
  paint: (undoable: Undoable | null) => Promise<void>,
  title: string = elementCopy.copyRefusedTitle,
  replacing: readonly ElementId[] = [],
): Promise<{ readonly copies: readonly Copied[]; readonly flushed: Promise<CommitOutcome> }> {
  const { edits, refused } = copyCommands(parts, register, copies)
  for (const refusal of refused)
    toast.refusal(title, { id: `copy-refused-${refusal}`, description: elementCopy.copyRefusedBody[refusal] })
  const file = fileSlides(parts, register)
  const went: ElementClone[] = []
  for (const edit of edits) if ((await connect(memoryRemote()).enqueueSlide(deckId, file, edit)).ok) went.push(edit)
  if (went.length === 0) return { copies: [], flushed: Promise.resolve("refused") }
  await paint(await replacedUndoable(deckId, parts, register, went, replacing))
  const made = went.map((edit) => ({ copy: edit.element.node, source: edit.source }))
  return { copies: made, flushed: flushPending(connect, deckId) }
}
