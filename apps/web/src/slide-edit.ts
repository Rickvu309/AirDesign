import {
  nextSlideId,
  orderKeyBetween,
  orderKeyAfter,
  presentSlides,
  readSlideId,
  type OrderKey,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { readSlides } from "@airdesign/pptx"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { flooredEdit } from "@/slide-floor"

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
    return { edit: { slide: "add", id, after: spot.id, key, layout: spot.id }, current: index + 1 }
  }
  return { edit: { slide: "clone", id, source: spot.id, key }, current: index + 1 }
}

export async function commitSlideChange(
  deckId: string,
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
  change: SlideChange,
  index: number,
  paint: (current: number) => void | Promise<void>,
  to = index,
): Promise<CommitOutcome> {
  const file = fileSlides(parts, register)
  const built = slideCommand(file, register.order, change, index, to)
  if (built === null) return "refused"
  const edit = flooredEdit(parts, register, file, built.edit)
  const kept = await connect(memoryRemote()).enqueueSlide(deckId, file, edit)
  if (!kept.ok) return "refused"
  await paint(built.current)
  return flushPending(connect, deckId)
}
