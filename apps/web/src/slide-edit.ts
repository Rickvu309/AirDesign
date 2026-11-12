import {
  nextSlideId,
  orderKeyBetween,
  orderKeyAfter,
  presentSlides,
  readSlideId,
  slideUndoable,
  type OrderKey,
  type Register,
  type SlideCommand,
  type SlideId,
  type Undoable,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { flooredEdit } from "@/slide-floor"
import { newSlideLayout } from "@/slide-layout"

export type SlideChange = "add" | "clone" | "remove" | "move"

export function fileSlides(parts: ReadonlyMap<string, Uint8Array>, register: Register): readonly SlideId[] {
  if (register.file.length > 0) return register.file
  const ids: SlideId[] = []
  for (const slide of readSlides(parts)) {
    const id = readSlideId(slide.slide)
    if (id === undefined) return []
    ids.push(id)
  }
  return ids
}

function taken(file: readonly SlideId[], order: Register["order"]): readonly string[] {
  const ids: string[] = [...file]
  for (const command of order) {
    if (command.slide === "add" || command.slide === "clone") ids.push(command.id)
  }
  return ids
}

function moved(spots: ReturnType<typeof presentSlides>, from: number, to: number): OrderKey | null {
  if (from === to || spots[from] === undefined || to < 0 || to >= spots.length) return null
  const next = [...spots]
  const [spot] = next.splice(from, 1)
  if (spot === undefined) return null
  next.splice(to, 0, spot)
  return orderKeyBetween(next[to - 1]?.key ?? null, next[to + 1]?.key ?? null)
}

export function slideCommand(
  file: readonly SlideId[],
  order: Register["order"],
  change: SlideChange,
  index: number,
  to = index,
  layoutPart?: string,
): { readonly edit: SlideCommand; readonly current: number } | null {
  const spots = presentSlides({ file, order })
  const spot = spots[index]
  if (spot === undefined) return null
  if (change === "remove") {
    if (spots.length < 2) return null
    return { edit: { slide: "remove", id: spot.id }, current: index < spots.length - 1 ? index : index - 1 }
  }
  if (change === "move") {
    const key = moved(spots, index, to)
    if (key === null) return null
    return { edit: { slide: "move", id: spot.id, key }, current: to }
  }
  const key = orderKeyAfter(spots, spot.id)
  if (key === null) return null
  const id = nextSlideId(taken(file, order))
  if (change === "add") {
    const part = layoutPart === undefined ? {} : { layoutPart }
    return { edit: { slide: "add", id, after: spot.id, key, layout: spot.id, ...part }, current: index + 1 }
  }
  return { edit: { slide: "clone", id, source: spot.id, key }, current: index + 1 }
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
): Promise<CommitOutcome> {
  const file = fileSlides(parts, register)
  const state = { file, order: register.order }
  const current = presentSlides(state)[index]
  const chosen =
    layoutPart ?? (change === "add" && current !== undefined ? newSlideLayout(parts, state, current.id) : undefined)
  const built = slideCommand(file, register.order, change, index, to, chosen)
  if (built === null) return "refused"
  const edit = flooredEdit(parts, register, file, built.edit)
  const undoable = slideUndoable(register, file, edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(built.current, undoable)
  return flushPending(connect, deckId)
}
