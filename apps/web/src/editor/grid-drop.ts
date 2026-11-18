import { gridMovePlacement } from "@airdesign/document"

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

export type GridMoveSide = "same" | "keep" | "new"

export type GridRange = { readonly start: number; readonly end: number }

export function gridIndices({ start, end }: GridRange): number[] {
  return Array.from({ length: end - start }, (_, offset) => start + offset)
}

export function gridDrop(rows: readonly GridRange[], held: readonly number[], at: number, side: GridMoveSide) {
  const before = rows.map(gridIndices)
  const after =
    before
      .flat()
      .slice(0, at)
      .filter((index) => !held.includes(index))
      .at(-1) ?? null
  const next = gridMovePlacement(before, held, after, side).rows
  if (
    next.length === before.length &&
    next.every(
      (row, number) =>
        row.length === before[number]?.length && row.every((index, offset) => index === before[number]?.[offset]),
    )
  )
    return null
  return next.flat().findIndex((index) => held.includes(index))
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
