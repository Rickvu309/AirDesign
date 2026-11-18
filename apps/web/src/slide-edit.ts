import {
  cloneMany,
  limits,
  foldSlides,
  gridCommandVersion,
  nextSlideId,
  presentSlides,
  readSlideId,
  slideUndoable,
  type Register,
  type SlideState,
  type GridSide,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { cloneFloor, flooredEdit } from "@/slide-floor"
import { newSlideLayout } from "@/slide-layout"

export type SlideChange = "add" | "clone" | "remove" | "move"
export type SlideSetChange = "clone" | "remove"
export type SelectedCopy = { readonly id: SlideId; readonly index: number }

export function fileSlides(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Pick<Register, "file" | "order">,
): readonly SlideId[] {
  if (register.file.length > 0) return register.file
  const ids: SlideId[] = []
  for (const slide of readSlides(parts)) {
    const id = readSlideId(slide.slide)
    if (id === undefined) return []
    ids.push(id)
  }
  return ids
}

export function slideCommand(
  state: SlideState,
  change: SlideChange,
  index: number,
  to = index,
  layoutPart?: string,
  row: GridSide = "same",
): { readonly edit: SlideCommand; readonly current: number } | null {
  const grid = gridCommandVersion(state)
  const spots = presentSlides(state)
  const spot = spots[index]
  if (spot === undefined) return null
  if (change === "remove") {
    if (spots.length < 2) return null
    return { edit: { slide: "remove", id: spot.id, grid }, current: index < spots.length - 1 ? index : index - 1 }
  }
  if (change === "move") {
    if (index === to || to < 0 || to >= spots.length) return null
    const remaining = spots.filter((row) => row.id !== spot.id)
    return {
      edit: { slide: "move", id: spot.id, after: remaining[to - 1]?.id ?? null, row: "same", grid },
      current: to,
    }
  }
  const id = nextSlideId(foldSlides(state).map((slide) => slide.id))
  if (change === "add") {
    const part = layoutPart === undefined ? {} : { layoutPart }
    const edit: SlideCommand = { slide: "add", id, after: spot.id, grid, row, layout: spot.id, ...part }
    return {
      edit,
      current: presentSlides({ ...state, order: [...state.order, edit] }).findIndex((slide) => slide.id === id),
    }
  }
  return { edit: { slide: "clone", id, source: spot.id, grid }, current: index + 1 }
}

export async function commitSlideChange(
  deckId: string,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
  change: SlideChange,
  index: number,
  paint: (current: number, undoable: Undoable | null) => void | Promise<void>,
  to = index,
  layoutPart?: string,
  row: GridSide = "same",
): Promise<CommitOutcome> {
  const file = fileSlides(parts, register)
  const state = { ...register, file }
  const current = presentSlides(state)[index]
  const chosen =
    layoutPart ?? (change === "add" && current !== undefined ? newSlideLayout(parts, state, current.id) : undefined)
  const built = slideCommand(state, change, index, to, chosen, row)
  if (built === null) return "refused"
  const edit = flooredEdit(parts, register, file, built.edit)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  const selected = edit.slide === "add" ? kept.painted.indexOf(edit.id) : built.current
  await paint(selected, undoable)
  return flushPending(connect, deckId)
}

export async function commitSlideMove(
  deckId: string,
  file: readonly SlideId[],
  register: Register,
  edit: Extract<SlideCommand, { slide: "move-many" }>,
  paint: (current: number, undoable: Undoable | null) => void | Promise<void>,
): Promise<CommitOutcome> {
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(kept.painted.indexOf(edit.ids[0]), undoable)
  return flushPending(connect, deckId)
}

type SetOutcome =
  | { readonly ok: true; readonly outcome: CommitOutcome }
  | { readonly ok: false; readonly message: "lastSlide" | "slideLimit" | "setRefused" }

export async function commitSlideSet(
  deck: string,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
  change: SlideSetChange,
  ids: readonly [SlideId, ...SlideId[]],
  paint: (current: number, copies: readonly SelectedCopy[], undoable: Undoable) => Promise<void>,
): Promise<SetOutcome> {
  const file = fileSlides(parts, register)
  const state = { ...register, file }
  const grid = gridCommandVersion(state)
  const slides = presentSlides(state)
  const first = slides.findIndex((slide) => ids.includes(slide.id))
  if (ids.some((id) => !slides.some((slide) => slide.id === id))) return { ok: false, message: "setRefused" }
  if (change === "remove" && ids.length >= slides.length) return { ok: false, message: "lastSlide" }
  if (change === "clone" && ids.length + slides.length > limits.slides) return { ok: false, message: "slideLimit" }
  const edit: SlideCommand | null =
    change === "remove" ? { slide: "remove-many", grid, ids } : cloneMany(state, ids, cloneFloor(parts, register))
  if (edit === null) return { ok: false, message: "setRefused" }
  const undoable = slideUndoable(register, file, edit)
  if (undoable === null) return { ok: false, message: "setRefused" }
  const kept = await connect(memoryRemote()).enqueueSlide(deck, file, edit)
  if (!kept.ok) return { ok: false, message: "setRefused" }
  const copies =
    edit.slide === "clone-many" ? edit.copies.map(({ id }) => ({ id, index: kept.painted.indexOf(id) })) : []
  await paint(copies[0]?.index ?? Math.min(first, kept.painted.length - 1), copies, undoable)
  return { ok: true, outcome: await flushPending(connect, deck) }
}
