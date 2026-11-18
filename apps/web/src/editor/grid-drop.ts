const edge = 56

const fastest = 24

export function dropPlace(x: number, card: { readonly left: number; readonly width: number }, index: number): number {
  return x < card.left + card.width / 2 ? index : index + 1
}

export function dropTarget(from: number, place: number): number | null {
  const to = place > from ? place - 1 : place
  return to === from ? null : to
}

type Room = { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

function edgeSpeed(at: number, start: number, length: number): number {
  const fromStart = at - start
  const fromEnd = start + length - at
  if (fromStart < edge) return Math.ceil((fastest * (edge - fromStart)) / edge)
  if (fromEnd < edge) return -Math.ceil((fastest * (edge - fromEnd)) / edge)
  return 0
}

export function edgePan(
  point: { readonly x: number; readonly y: number },
  room: Room,
): { readonly x: number; readonly y: number } {
  const outside =
    point.x < room.left || point.x > room.left + room.width || point.y < room.top || point.y > room.top + room.height
  if (outside) return { x: 0, y: 0 }
  return { x: edgeSpeed(point.x, room.left, room.width), y: edgeSpeed(point.y, room.top, room.height) }
}

export function landing(held: readonly number[], at: number): number {
  return at - held.filter((index) => index < at).length
}

export function dragMoves(
  held: readonly number[],
  at: number,
  count: number,
): readonly { readonly from: number; readonly to: number }[] {
  const order = Array.from({ length: count }, (_, index) => index)
  const rest = order.filter((index) => !held.includes(index))
  let anchor = rest[landing(held, at)]
  const moves: { from: number; to: number }[] = []
  for (const slide of [...held].sort((a, b) => b - a)) {
    const from = order.indexOf(slide)
    const before = anchor === undefined ? count : order.indexOf(anchor)
    const to = before - (from < before ? 1 : 0)
    if (from !== to) {
      moves.push({ from, to })
      order.splice(from, 1)
      order.splice(to, 0, slide)
    }
    anchor = slide
  }
  return moves
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

export const terminalRowBand = 80

export function rowPan(delta: number, pointerY: number, firstTop: number, lastBottom: number): number {
  const clearance = terminalRowBand / 2
  return delta > 0
    ? Math.min(delta, Math.max(0, pointerY + clearance - firstTop))
    : Math.max(delta, Math.min(0, pointerY - clearance - lastBottom))
}
