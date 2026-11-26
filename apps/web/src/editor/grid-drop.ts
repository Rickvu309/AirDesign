import type { GridCard, GridLayout, GridRect, GridSize } from "@/editor/grid-lines"
import { gridAnchor, gridMovePlacement, sameGroups, type GridMoveSide } from "@/editor/grid-move"

export type GridRange = { readonly start: number; readonly end: number }

export type GridBand = GridRange & {
  readonly top: number
  readonly bottom: number
  readonly width: number
  readonly wrapped: boolean
}

export type GridDrop = { readonly at: number; readonly side: GridMoveSide }

type GridGaps = { readonly column: number; readonly line: number }

export const terminalGroupBand = 80

export function gridRanges(layout: GridLayout): readonly GridRange[] {
  const ranges: GridRange[] = []
  for (const card of layout.cards) {
    const last = ranges[card.group]
    ranges[card.group] =
      last === undefined ? { start: card.index, end: card.index + 1 } : { ...last, end: card.index + 1 }
  }
  return ranges
}

export function gridBands(layout: GridLayout): readonly GridBand[] {
  return gridRanges(layout).map((range) => {
    const cards = layout.cards.slice(range.start, range.end)
    const top = Math.min(...cards.map((card) => card.top))
    return {
      ...range,
      top,
      bottom: Math.max(...cards.map((card) => card.top + card.height)),
      width: Math.max(...cards.map((card) => card.left + card.width)),
      wrapped: cards.some((card) => card.top !== top),
    }
  })
}

export function gridIndices({ start, end }: GridRange): number[] {
  return Array.from({ length: end - start }, (_, offset) => start + offset)
}

function rangeOf(groups: readonly GridRange[], index: number): GridRange | undefined {
  return groups.find((group) => index >= group.start && index < group.end)
}

export function dropPlace(x: number, card: { readonly left: number; readonly width: number }, index: number): number {
  return x < card.left + card.width / 2 ? index : index + 1
}

export function dropTarget(from: number, place: number): number | null {
  const to = place > from ? place - 1 : place
  return to === from ? null : to
}

export function gridDrop(groups: readonly GridRange[], held: readonly number[], at: number, side: GridMoveSide) {
  const before = groups.map(gridIndices)
  const sequence = before.flat()
  const holding = new Set(held)
  const anchor = gridAnchor(sequence, holding, at, side)
  const destination = side === "before" ? groups.find((group) => group.start === at) : undefined
  if (side === "before" && (destination === undefined || anchor === null || anchor >= destination.end)) return null
  const next = gridMovePlacement(before, held, anchor, side)
  if (sameGroups(next, before)) return null
  return next.flat().findIndex((index) => holding.has(index))
}

export function previewSlot(index: number, from: number, to: number | null): number {
  if (to === null) return index
  if (index === from) return to
  if (from < to && index > from && index <= to) return index - 1
  if (to < from && index >= to && index < from) return index + 1
  return index
}

export function slotUnder(
  point: { readonly x: number; readonly y: number },
  cards: readonly GridCard[],
  groups: readonly GridRange[],
  gaps: GridGaps,
): GridCard | undefined {
  return cards.find((card) => {
    const last = groups.some((group) => group.end === card.index + 1)
    return (
      point.x >= card.left - gaps.column / 2 &&
      point.x < card.left + card.width + (last ? gaps.column : gaps.column / 2) &&
      point.y >= card.top - gaps.line / 2 &&
      point.y < card.top + card.height + gaps.line / 2
    )
  })
}

export function dropAt(groups: readonly GridRange[], held: readonly number[], slot: number, at: number): GridDrop {
  const band = rangeOf(groups, slot)
  return band !== undefined && gridIndices({ start: band.start, end: at }).every((index) => held.includes(index))
    ? { at: band.start, side: "before" }
    : { at, side: "same" }
}

export function liveTarget(groups: readonly GridRange[], from: number, slot: number, at: number): number | null {
  const home = rangeOf(groups, from)
  return home !== undefined && home === rangeOf(groups, slot) && at < home.end ? dropTarget(from, at) : null
}

export function groupPan(delta: number, pointerY: number, firstTop: number, lastBottom: number): number {
  const clearance = terminalGroupBand / 2
  return delta > 0
    ? Math.min(delta, Math.max(0, pointerY + clearance - firstTop))
    : Math.max(delta, Math.min(0, pointerY - clearance - lastBottom))
}

export function groupDrop(
  bands: readonly GridBand[],
  y: number,
  scale: number,
): { readonly at: number; readonly top: number } | null {
  const reach = terminalGroupBand / scale
  const next = bands.find((band, i) => y < band.top && y >= (bands[i - 1]?.bottom ?? band.top - reach))
  const previous = next === undefined ? undefined : bands[bands.indexOf(next) - 1]
  if (next !== undefined)
    return { at: next.start, top: previous === undefined ? next.top - reach / 2 : (previous.bottom + next.top) / 2 }
  const last = bands.at(-1)
  return last !== undefined && y >= last.bottom && y <= last.bottom + reach
    ? { at: last.end, top: last.bottom + reach / 2 }
    : null
}

export function moveBelowPlace(groups: readonly GridRange[], held: readonly number[], index: number): number | null {
  const group = rangeOf(groups, index)
  return group === undefined || gridDrop(groups, held, group.end, "new") === null ? null : group.end
}

export function slideBar(card: GridRect, at: number, index: number, column: number): GridRect {
  const left = at === index ? card.left - column / 2 : card.left + card.width + column / 2
  return { left, top: card.top, width: 0, height: card.height }
}

export function groupBar(top: number, size: GridSize): GridRect {
  return { left: 0, top, width: size.width, height: 0 }
}
