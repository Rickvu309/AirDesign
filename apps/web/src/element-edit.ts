import {
  cloneOf,
  decide,
  elementId,
  elementsUndoable,
  lineGeometries,
  nextElementId,
  openingChart,
  openingTable,
  openingTableSize,
  writeChartValue,
  type ChartKind,
  placeChart,
  placeNewBox,
  writeTableValue,
  readSlideId,
  shapeOf,
  slideUndoable,
  stackTarget,
  swapUndoable,
  textOpening,
  type Command,
  type CopiedRows,
  type ElementClone,
  type ElementCommand,
  type StackMove,
  type Box,
  type ElementPatch,
  type ElementId,
  type Geometry,
  type PlacedChart,
  type Register,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { applyRoute, freeShapeId, readShapes, readSlides, shapeSiblings } from "@airdesign/pptx"
import { boxOf, type Copied, type Moved, type PaintBox, type ShapeDrawn } from "@airdesign/render"
import { toast } from "@/components/ui/toast"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { elementCopy, type CopyRefusal, type RemovalRefusal } from "@/copy/element-copy"
import { groupPlanned, type GroupChange } from "@/editor/group-actions"
import { joinPlanned, type LayerJoin } from "@/editor/layer-join"
import { storeCommand } from "@/command-store"
import { slideBase } from "@/exported-parts"
import { framedOf } from "@/frame-boxes"
import { indexedRegister } from "@/indexed-register"
import { fileSlides } from "@/slide-edit"

type Parts = ReadonlyMap<string, Uint8Array>

const textLine = 274_320
const shapeShare = 0.2
const chartShare = 0.5
const lineShare = 0.3

type RoomText = { readonly paragraphs: readonly { readonly runs: readonly { readonly text: string }[] }[] }

type RoomElement = {
  readonly box: PaintBox | null
  readonly id?: ElementId | null
  readonly placeholder?: boolean
  readonly text?: RoomText | null
  readonly chart?: unknown
}

export type SlideRoom = {
  readonly width: number
  readonly height: number
  readonly elements?: readonly RoomElement[]
}

function emptyPlaceholder(element: RoomElement): boolean {
  const words = (element.text?.paragraphs ?? []).flatMap((paragraph) => paragraph.runs.map((run) => run.text))
  return element.placeholder === true && words.join("").trim() === ""
}

function chartRoom(room: SlideRoom): { readonly taken: readonly Box[]; readonly charts: readonly PlacedChart[] } {
  const shown = (room.elements ?? []).filter((each) => !emptyPlaceholder(each))
  const taken = takenBoxes({ ...room, elements: shown })
  const charts = shown.flatMap((each, at) =>
    each.chart === undefined || each.box === null
      ? []
      : [{ node: each.id ?? elementId(`0.${String(at)}`), box: boxOf(each.box) }],
  )
  return { taken, charts }
}

export type TableSize = { readonly rows: number; readonly columns: number }

export type LayerSpot = { readonly before: ElementId | null }

export type TextPlace = { readonly x: number; readonly y: number; readonly cx?: number; readonly cy?: number }

export type ElementChange =
  | { readonly change: "text"; readonly index: number; readonly size: SlideRoom; readonly place?: TextPlace }
  | ({ readonly change: "table"; readonly index: number; readonly size: SlideRoom } & TableSize)
  | { readonly change: "chart"; readonly kind: ChartKind; readonly index: number; readonly size: SlideRoom }
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
  if (change.change === "table") {
    const box = placeNewBox(change.size, taken, openingTableSize(change.size.width, change.rows))
    const value = writeTableValue(openingTable(change.rows, change.columns))
    return { slide: "element-add", id: slide.id, element: { node, kind: "table", value, box, grouped: false } }
  }
  if (change.change === "chart") {
    const wanted = { cx: Math.round(change.size.width * chartShare), cy: Math.round(change.size.height * chartShare) }
    const { taken: free, charts } = chartRoom(change.size)
    const { box } = placeChart(change.size, free, charts, wanted, false)
    const value = writeChartValue(openingChart(change.kind))
    return { slide: "element-add", id: slide.id, element: { node, kind: "chart", value, box, grouped: false } }
  }
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

export type ElementPlan = {
  readonly commands: readonly Command[]
  readonly added: ElementId | null
  readonly undo: (stored: readonly Command[]) => Undoable | null
  readonly partial: boolean
}

function removalPlan(parts: Parts, register: Register, nodes: readonly ElementId[]): ElementPlan | null {
  const { edits, refused } = removals(parts, register, nodes)
  for (const refusal of refused)
    toast.refusal(elementCopy.removeRefusedTitle, {
      id: `remove-refused-${refusal}`,
      description: elementCopy.removeRefusedBody[refusal],
    })
  if (edits.length === 0) return null
  const file = fileSlides(parts, register)
  const commands = edits.map((edit): Command => ({ command: "slide", file, edit }))
  const removed = (stored: readonly Command[]) =>
    stored.flatMap((command) =>
      command.command === "slide" && command.edit.slide === "element-remove" ? [command.edit] : [],
    )
  return { commands, added: null, undo: (stored) => elementsUndoable(register, file, removed(stored)), partial: true }
}

export function planElement(parts: Parts, register: Register, change: ElementChange): ElementPlan | null {
  if (
    change.change === "group" ||
    change.change === "ungroup" ||
    change.change === "frame" ||
    change.change === "plain-frame" ||
    change.change === "mask"
  ) {
    const grouped = groupPlanned(parts, register, change)
    return grouped === null
      ? null
      : { commands: grouped.commands, added: grouped.made, undo: () => grouped.undoable, partial: false }
  }
  if (change.change === "remove") return removalPlan(parts, register, change.nodes)
  if (change.change === "join") {
    const joined = joinPlanned(parts, register, change)
    return joined === null
      ? null
      : { commands: joined.commands, added: null, undo: () => joined.undoable, partial: false }
  }
  const edit = elementCommand(parts, register, change)
  if (edit === null) return null
  const file = fileSlides(parts, register)
  const undoable = slideUndoable(register, file, edit)
  const added = edit.slide === "element-add" ? edit.element.node : null
  return { commands: [{ command: "slide", file, edit }], added, undo: () => undoable, partial: false }
}

export async function storePlan(deckId: string, plan: ElementPlan): Promise<readonly Command[] | null> {
  const stored: Command[] = []
  for (const command of plan.commands) {
    if (await storeCommand(deckId, command)) stored.push(command)
    else if (!plan.partial) return null
  }
  return stored.length === 0 ? null : stored
}

export async function commitElement(
  deckId: string,
  parts: Parts,
  register: Register,
  change: ElementChange,
  paint: (added: ElementId | null, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const plan = planElement(parts, register, change)
  const stored = plan === null ? null : await storePlan(deckId, plan)
  if (plan === null || stored === null) return "refused"
  await paint(plan.added, plan.undo(stored))
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

export function copyPlan(
  parts: Parts,
  register: Register,
  copies: readonly CopyAsked[],
  title: string = elementCopy.copyRefusedTitle,
): { readonly plan: ElementPlan; readonly copies: readonly Copied[] } | null {
  const { edits, refused } = copyCommands(parts, register, copies)
  for (const refusal of refused)
    toast.refusal(title, { id: `copy-refused-${refusal}`, description: elementCopy.copyRefusedBody[refusal] })
  if (edits.length === 0) return null
  const file = fileSlides(parts, register)
  const cloned = (stored: readonly Command[]) =>
    stored.flatMap((command) =>
      command.command === "slide" && command.edit.slide === "element-clone" ? [command.edit] : [],
    )
  const plan: ElementPlan = {
    commands: edits.map((edit): Command => ({ command: "slide", file, edit })),
    added: null,
    undo: (stored) => elementsUndoable(register, file, cloned(stored)),
    partial: true,
  }
  return { plan, copies: edits.map((edit) => ({ copy: edit.element.node, source: edit.source })) }
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
