export type GridGroup = { readonly start: number; readonly end: number }
export type GridLine = { readonly group: number; readonly cards: readonly number[] }
export type GridSize = { readonly width: number; readonly height: number }

export const gridNumberRoom = 24
const fitPadding = 48
const haloBand = 30
const numberAboveGap = 88
const scales = { least: 0.01, most: 4 }

export function gridGroups(count: number, starts: readonly number[]): GridGroup[] {
  const cuts = [0, ...starts.filter((start) => start > 0 && start < count), count]
  return cuts.slice(0, -1).flatMap((start, index) => {
    const end = cuts[index + 1] ?? count
    return end > start ? [{ start, end }] : []
  })
}

function baseColumns(count: number): number {
  return Math.min(10, Math.max(4, Math.ceil(Math.sqrt(Math.max(0, count) * 1.5))))
}

function packed(lengths: readonly number[], columns: number): number {
  return lengths.reduce((total, length) => total + Math.max(1, Math.ceil(length / columns)), 0)
}

export function gridColumns(count: number, groups: readonly GridGroup[]): number {
  const base = baseColumns(count)
  const lengths = groups.map((group) => group.end - group.start)
  if (groups.length < 2 || lengths.every((length) => length <= base)) return base
  let columns = base
  let lines = packed(lengths, base)
  for (let next = base + 1; next <= 10; next += 1) {
    const candidate = packed(lengths, next)
    if (candidate < lines) {
      columns = next
      lines = candidate
    }
  }
  return columns
}

export function gridLines(count: number, groups: readonly GridGroup[]): GridLine[] {
  const columns = gridColumns(count, groups)
  return groups.flatMap((group, number) => {
    const lines: GridLine[] = []
    for (let start = group.start; start < group.end; start += columns) {
      const end = Math.min(group.end, start + columns)
      lines.push({ group: number, cards: Array.from({ length: end - start }, (_, offset) => start + offset) })
    }
    return lines
  })
}

export function gridGaps(slide: GridSize): { readonly column: number; readonly group: number; readonly wrap: number } {
  const column = slide.width * 0.13
  const group = slide.height * 0.57
  const needed = (haloBand * group) / numberAboveGap - gridNumberRoom
  const wrap = Math.max(column, needed)
  return { column, group, wrap: wrap < group ? wrap : group / 2 }
}

export function gridGapAfter(lines: readonly GridLine[], index: number, slide: GridSize): number {
  const line = lines[index]
  const next = lines[index + 1]
  if (line === undefined || next === undefined) return 0
  const gaps = gridGaps(slide)
  return next.group === line.group ? gaps.wrap : gaps.group
}

export function gridBlock(lines: readonly GridLine[], slide: GridSize): GridSize {
  const widest = Math.max(1, ...lines.map((line) => line.cards.length))
  const gaps = lines.reduce((total, _, index) => total + gridGapAfter(lines, index, slide), 0)
  return {
    width: widest * slide.width + (widest - 1) * gridGaps(slide).column,
    height: lines.length * slide.height + gaps,
  }
}

export function gridFitScale(lines: readonly GridLine[], slide: GridSize, room: GridSize): number {
  const block = gridBlock(lines, slide)
  const wide = (room.width - 2 * fitPadding) / block.width
  const tall = (room.height - 2 * fitPadding - lines.length * gridNumberRoom) / block.height
  return Math.max(scales.least, Math.min(scales.most, wide, tall))
}
