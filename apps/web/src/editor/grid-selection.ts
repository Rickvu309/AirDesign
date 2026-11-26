export type GridPick = { readonly anchor: string; readonly slides: ReadonlySet<string> } | null

type Order = readonly string[]

function heldPick(anchor: string | undefined, slides: ReadonlySet<string>): GridPick {
  return anchor !== undefined && slides.size > 0 ? { anchor, slides } : null
}

export function pickedSlides(pick: GridPick, order: Order, current: number): readonly number[] {
  const held = pick === null ? [] : order.flatMap((id, index) => (pick.slides.has(id) ? [index] : []))
  return held.length === 0 ? [current] : held
}

function pickedIds(pick: GridPick, order: Order, current: number): Set<string> {
  return new Set(pickedSlides(pick, order, current).flatMap((index) => order[index] ?? []))
}

export function pickToggle(pick: GridPick, order: Order, index: number, current: number): GridPick {
  const id = order[index]
  if (id === undefined) return pick
  const held = pickedIds(pick, order, current)
  if (held.has(id)) held.delete(id)
  else held.add(id)
  return heldPick(id, held)
}

export function pickRange(pick: GridPick, order: Order, index: number, current: number): GridPick {
  const kept = pick === null ? -1 : order.indexOf(pick.anchor)
  const anchor = kept === -1 ? current : kept
  const low = Math.min(anchor, index)
  const high = Math.max(anchor, index)
  return heldPick(order[anchor], new Set(order.slice(low, high + 1)))
}

export function pickAll(order: Order, current: number): GridPick {
  return heldPick(order[current] ?? order[0], new Set(order))
}

export function prunedPick(pick: GridPick, order: Order): GridPick {
  if (pick === null) return null
  const slides = new Set(order.filter((id) => pick.slides.has(id)))
  return heldPick(slides.has(pick.anchor) ? pick.anchor : order.find((id) => slides.has(id)), slides)
}

export function toggledCurrent(pick: GridPick, order: Order, index: number): number {
  const id = order[index]
  if (pick === null || (id !== undefined && pick.slides.has(id))) return index
  const left = pickedSlides(pick, order, index)
  return left.filter((slide) => slide < index).at(-1) ?? left[0] ?? index
}
