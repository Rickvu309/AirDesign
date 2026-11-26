import { pickRange, pickToggle, prunedPick, toggledCurrent, type GridPick } from "@/editor/grid-selection"

export type SlidePress = "only" | "range" | "toggle" | "menu"

export type ListPick = { readonly pick: GridPick; readonly current: number }

function several(pick: GridPick): GridPick {
  return pick !== null && pick.slides.size > 1 ? pick : null
}

export function slidePress(event: {
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly ctrlKey: boolean
}): SlidePress {
  if (event.shiftKey) return "range"
  return event.metaKey || event.ctrlKey ? "toggle" : "only"
}

export function pressedPick(
  pick: GridPick,
  ids: readonly string[],
  index: number,
  current: number,
  press: SlidePress,
): ListPick {
  const id = ids[index]
  if (press === "menu" && id !== undefined && pick?.slides.has(id) === true) return { pick, current }
  if (press === "only" || press === "menu") return { pick: null, current: index }
  const next = press === "range" ? pickRange(pick, ids, index, current) : pickToggle(pick, ids, index, current)
  return { pick: several(next), current: toggledCurrent(next, ids, index) }
}

export function heldOf(slides: readonly number[], ids: readonly string[]): GridPick {
  const held = slides.flatMap((index) => ids[index] ?? [])
  const [anchor] = held
  return anchor === undefined ? null : { anchor, slides: new Set(held) }
}

export function livePick(held: GridPick, current: number, ids: readonly string[]): GridPick {
  const pick = several(prunedPick(held, ids))
  const id = ids[current]
  return id !== undefined && pick?.slides.has(id) === true ? pick : null
}

export type PickAt = { readonly pick: GridPick; readonly current: string | undefined }

export type SetStep = {
  readonly before: string
  readonly after: string
  readonly seen: string
  readonly undone: PickAt
  readonly done: PickAt
}

export type SetTurn = { readonly at: PickAt | null; readonly step: SetStep | null }

export function setStepOf(before: readonly string[], after: readonly string[], undone: PickAt, done: PickAt): SetStep {
  const next = after.join(",")
  return { before: before.join(","), after: next, seen: next, undone, done }
}

export function turnedPick(step: SetStep, ids: readonly string[]): SetTurn {
  const key = ids.join(",")
  if (key === step.seen) return { at: null, step }
  if (key === step.before) return { at: step.undone, step: { ...step, seen: key } }
  if (key === step.after) return { at: step.done, step: { ...step, seen: key } }
  return { at: null, step: null }
}

export function setDropPlace(held: readonly number[], index: number): number | null {
  if (held.includes(index)) return null
  return index > (held.at(-1) ?? index) ? index + 1 : index
}
