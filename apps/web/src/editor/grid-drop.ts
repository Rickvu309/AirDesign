const edge = 56

const fastest = 24

export function dropPlace(x: number, card: { readonly left: number; readonly width: number }, index: number): number {
  return x < card.left + card.width / 2 ? index : index + 1
}

export function dropTarget(from: number, place: number): number | null {
  const to = place > from ? place - 1 : place
  return to === from ? null : to
}

export function edgeScroll(y: number, list: { readonly top: number; readonly height: number }): number {
  const fromTop = y - list.top
  const fromBottom = list.top + list.height - y
  if (fromTop < edge) return -Math.ceil((fastest * (edge - Math.max(fromTop, 0))) / edge)
  if (fromBottom < edge) return Math.ceil((fastest * (edge - Math.max(fromBottom, 0))) / edge)
  return 0
}

export type GridSlot = {
  readonly index: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

const halfGap = 16

const below = 48

export function previewSlot(index: number, from: number, to: number | null): number {
  if (to === null) return index
  if (index === from) return to
  if (from < to && index > from && index <= to) return index - 1
  if (to < from && index >= to && index < from) return index + 1
  return index
}

export function slotUnder(x: number, y: number, slots: readonly GridSlot[]): GridSlot | undefined {
  return slots.find(
    (slot) =>
      x >= slot.left - halfGap &&
      x < slot.left + slot.width + halfGap &&
      y >= slot.top - halfGap &&
      y < slot.top + slot.height + below,
  )
}
