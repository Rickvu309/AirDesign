import {
  foldSlides,
  gridCommandVersion,
  nextSlideId,
  presentSlides,
  readSlideId,
  type Register,
  type SlideState,
  type GridSide,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { readSlides } from "@airdesign/pptx"

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
