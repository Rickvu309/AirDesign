import type { NodeId } from "@airdesign/doom"

export type GridPick = {
  readonly anchor: number
  readonly slides: ReadonlySet<number>
  readonly copies?: ReadonlySet<NodeId>
} | null

function sorted(slides: Iterable<number>): readonly number[] {
  return [...slides].sort((left, right) => left - right)
}

function heldPick(anchor: number, slides: ReadonlySet<number>): GridPick {
  return slides.size > 0 ? { anchor, slides } : null
}

export function pickedSlides(pick: GridPick, current: number): readonly number[] {
  return pick === null ? [current] : sorted(pick.slides)
}

export function pickToggle(pick: GridPick, index: number, current: number): GridPick {
  const held = new Set(pick === null ? [current] : pick.slides)
  if (held.has(index)) held.delete(index)
  else held.add(index)
  return heldPick(index, held)
}

export function pickRange(pick: GridPick, index: number, current: number): GridPick {
  const anchor = pick === null ? current : pick.anchor
  const low = Math.min(anchor, index)
  const high = Math.max(anchor, index)
  return heldPick(anchor, new Set(Array.from({ length: high - low + 1 }, (_, offset) => low + offset)))
}

export function prunedPick(pick: GridPick, count: number, ids?: readonly NodeId[]): GridPick {
  if (pick === null) return null
  const copies = pick.copies
  if (copies !== undefined && ids !== undefined) {
    const indices = ids.flatMap((id, index) => (copies.has(id) ? [index] : []))
    const first = indices[0]
    return first === undefined ? null : heldPick(first, new Set(indices))
  }
  return heldPick(pick.anchor, new Set([...pick.slides].filter((index) => index < count)))
}

export function toggledCurrent(pick: GridPick, index: number): number {
  if (pick === null || pick.slides.has(index)) return index
  const left = sorted(pick.slides)
  return left.filter((slide) => slide < index).at(-1) ?? left[0] ?? index
}
