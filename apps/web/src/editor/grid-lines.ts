export const gridCardInset = 24

const gridNumberAboveGap = 88
const gridHaloBand = 30

export type GridLineTrack = {
  readonly number: number
  readonly start: number
  readonly end: number
  readonly heads: readonly number[]
  readonly cards: readonly number[]
}

export function gridBaseColumns(count: number): number {
  return Math.min(10, Math.max(4, Math.ceil(Math.sqrt(Math.max(0, count) * 1.5))))
}

export function gridWrapColumns(
  count: number,
  groups: readonly { readonly start: number; readonly end: number }[],
): number {
  const base = gridBaseColumns(count)
  if (groups.length < 2) return base
  const lengths = groups.map((group) => group.end - group.start)
  if (lengths.every((length) => length <= base)) return base
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

function packed(lengths: readonly number[], columns: number): number {
  return lengths.reduce((total, length) => total + Math.max(1, Math.ceil(length / Math.max(1, columns))), 0)
}

export function gridLineGap(groupGap: number, columnGap: number): number {
  const needed = (gridHaloBand * groupGap) / gridNumberAboveGap - gridCardInset
  const gap = Math.max(columnGap, needed)
  return gap < groupGap ? gap : groupGap / 2
}

export function gridVisualLines<T extends GridLineTrack>(tracks: readonly T[], columns: number): T[] {
  return tracks.flatMap((track) => {
    if (track.end - track.start <= columns) return [track]
    const lines: T[] = []
    for (let start = track.start; start < track.end; start += columns) {
      const end = Math.min(track.end, start + columns)
      const heads = track.heads.filter((index) => index >= start && index < end)
      const cards = track.cards.filter((index) => index >= start && index < end)
      if (heads.length === 0 && cards.length === 0) continue
      lines.push({ ...track, start, end, heads, cards })
    }
    return lines
  })
}

export function gridHandleCenter(lines: number, heading: number, slide: number, lineGap: number): number {
  return heading + gridCardInset + slide / 2 + ((lines - 1) * (slide + gridCardInset + lineGap)) / 2
}

type MeasuredLine = { readonly cards: readonly number[]; readonly heading: number }

function lineContent(line: MeasuredLine, slide: number): number {
  return (line.cards.length > 0 ? slide + gridCardInset : 0) + line.heading
}

export function gridSlideCenters(lines: readonly MeasuredLine[], slide: number, gaps: readonly number[]): number[] {
  const centers: number[] = []
  let top = 0
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) continue
    if (line.cards.length > 0) centers.push(top + line.heading + gridCardInset + slide / 2)
    top += lineContent(line, slide) + (gaps[index] ?? 0)
  }
  return centers
}

export function gridFrameHeight(lines: readonly MeasuredLine[], slide: number, gaps: readonly number[]): number {
  return lines.reduce((total, line, index) => {
    const gap = index === lines.length - 1 ? 0 : (gaps[index] ?? 0)
    return total + lineContent(line, slide) + gap
  }, 0)
}

export function gridGroupCenter(centers: readonly number[]): number {
  const first = centers[0]
  const last = centers.at(-1)
  if (first === undefined || last === undefined) return 0
  return (first + last) / 2
}
