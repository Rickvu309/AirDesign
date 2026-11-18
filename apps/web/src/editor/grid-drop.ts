import { gridMovePlacement, type SlideCommand } from "@airdesign/document"
import { gridSpacing } from "@/editor/grid-viewport"

export const dragSlop = 4

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

export type GridMoveSide = Extract<SlideCommand, { slide: "move-many" }>["row"]

export type GridRange = { readonly start: number; readonly end: number }

export function gridIndices({ start, end }: GridRange): number[] {
  return Array.from({ length: end - start }, (_, offset) => start + offset)
}

export function gridAnchor<Id>(sequence: readonly Id[], held: readonly number[], at: number, side: GridMoveSide) {
  if (side === "before") return sequence.slice(at).find((_, offset) => !held.includes(at + offset)) ?? null
  return (
    sequence
      .slice(0, at)
      .filter((_, index) => !held.includes(index))
      .at(-1) ?? null
  )
}

export function gridDrop(rows: readonly GridRange[], held: readonly number[], at: number, side: GridMoveSide) {
  const before = rows.map(gridIndices)
  const anchor = gridAnchor(before.flat(), held, at, side)
  const destination = side === "before" ? rows.find((row) => row.start === at) : undefined
  if (side === "before" && (destination === undefined || anchor === null || anchor >= destination.end)) return null
  const next = gridMovePlacement(before, held, anchor, side).rows
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

export function slotUnder(
  x: number,
  y: number,
  slots: readonly GridSlot[],
  rows: readonly GridRange[],
): GridSlot | undefined {
  return slots.find((slot) => {
    const last = rows.some((row) => row.end === slot.index + 1)
    const gap = last ? gridSpacing(slot.width, slot.height).column : halfGap
    return (
      x >= slot.left - halfGap &&
      x < slot.left + slot.width + gap &&
      y >= slot.top - halfGap &&
      y < slot.top + slot.height + below
    )
  })
}

export const terminalRowBand = 80

export function rowPan(delta: number, pointerY: number, firstTop: number, lastBottom: number): number {
  const clearance = terminalRowBand / 2
  return delta > 0
    ? Math.min(delta, Math.max(0, pointerY + clearance - firstTop))
    : Math.max(delta, Math.min(0, pointerY - clearance - lastBottom))
}

function rangeOf(rows: readonly GridRange[], index: number): GridRange | undefined {
  return rows.find((row) => index >= row.start && index < row.end)
}

export function dropAt(
  rows: readonly GridRange[],
  held: readonly number[],
  slot: number,
  at: number,
): { readonly at: number; readonly side: GridMoveSide } {
  const band = rangeOf(rows, slot)
  return band !== undefined && gridIndices({ start: band.start, end: at }).every((index) => held.includes(index))
    ? { at: band.start, side: "before" }
    : { at, side: "same" }
}

export function liveTarget(rows: readonly GridRange[], from: number, slot: number, at: number): number | null {
  const home = rangeOf(rows, from)
  return home !== undefined && home === rangeOf(rows, slot) && at < home.end ? dropTarget(from, at) : null
}

export type GridBand = GridRange & { readonly top: number; readonly bottom: number }

export function rowDrop(
  bands: readonly GridBand[],
  y: number,
  scale: number,
): { readonly at: number; readonly top: number } | null {
  const reach = terminalRowBand / scale
  const next = bands.find((band, i) => y < band.top && y >= (bands[i - 1]?.bottom ?? band.top - reach))
  const previous = next === undefined ? undefined : bands[bands.indexOf(next) - 1]
  if (next !== undefined)
    return { at: next.start, top: previous === undefined ? next.top - reach / 2 : (previous.bottom + next.top) / 2 }
  const last = bands.at(-1)
  return last !== undefined && y >= last.bottom && y <= last.bottom + reach
    ? { at: last.end, top: last.bottom + reach / 2 }
    : null
}

export function moveBelowPlace(rows: readonly GridRange[], held: readonly number[], index: number): number | null {
  const row = rangeOf(rows, index)
  return row === undefined || gridDrop(rows, held, row.end, "new") === null ? null : row.end
}
