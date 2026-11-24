import { type Context, type Entry, markShare, muted, seriesColor, smaller } from "./chart-context.js"
import { type Words, block, spot, words, wordsHeight, wordsWidth, wrappedHeight } from "./chart-parts.js"
import type { Resolved } from "./resolved.js"

const legendGap = 28
const swatchGap = 10
const rowGap = 8
const noteGap = 24
const pitchGaps = [18, 4, 1]

export type Legend = {
  readonly w: number
  readonly h: number
  readonly place: (x: number, y: number) => readonly Resolved[]
}

export const legendLooks = (context: Context): readonly Words[] => [
  muted(context.theme),
  smaller(context, muted(context.theme)),
]

type Grid = { readonly columns: readonly (readonly Entry[])[]; readonly rows: number }

function measured(context: Context, look: Words, cap = Number.POSITIVE_INFINITY) {
  const lineH = wordsHeight(context, look)
  const swatch = Math.round(lineH * markShare)
  const noteLook = { ...look, color: context.theme.colors.text }
  const nameW = (entry: Entry) => Math.min(cap, wordsWidth(context, entry.name, look) + 2)
  const nameH = (entry: Entry) => Math.max(lineH, wrappedHeight(context, entry.name, look, nameW(entry)))
  const noteW = (entry: Entry) => (entry.note === undefined ? 0 : wordsWidth(context, entry.note, noteLook) + 2)
  const shape = (column: readonly Entry[]) => {
    const names = Math.max(0, ...column.map(nameW))
    const notes = Math.max(0, ...column.map(noteW))
    return { names, w: swatch + swatchGap + names + (notes === 0 ? 0 : noteGap + notes) }
  }
  const width = (grid: Grid) =>
    grid.columns.reduce((sum, column) => sum + shape(column).w, 0) + legendGap * (grid.columns.length - 1)
  const draw = (
    header: string | undefined,
    grid: Grid,
    top: (column: number, row: number) => number,
    x: number,
    y: number,
    order: readonly Entry[],
  ) => {
    const heading: Resolved[] = []
    const owned = new Map<Entry, Resolved[]>()
    if (header !== undefined)
      heading.push(
        words(
          `${context.frame}#~unit`,
          context,
          header,
          spot(x, y, wordsWidth(context, header, look) + 2, lineH),
          look,
        ),
      )
    let left = x
    grid.columns.forEach((column, index) => {
      const { names, w } = shape(column)
      column.forEach((entry, row) => {
        const at = y + top(index, row)
        const parts: Resolved[] = []
        owned.set(entry, parts)
        parts.push(
          block(
            `${context.frame}#~swatch:${String(order.indexOf(entry))}`,
            spot(left, at + (lineH - swatch) / 2, swatch, swatch),
            entry.color,
            3,
          ),
          words(
            `${context.frame}#~legend:${String(order.indexOf(entry))}`,
            context,
            entry.name,
            spot(left + swatch + swatchGap, at, nameW(entry), nameH(entry)),
            look,
          ),
        )
        if (entry.note !== undefined)
          parts.push(
            words(
              `${context.frame}#~note:${String(order.indexOf(entry))}`,
              context,
              entry.note,
              spot(left + swatch + swatchGap + names + noteGap, at, noteW(entry), lineH),
              noteLook,
            ),
          )
      })
      left += w + legendGap
    })
    const parts = [...heading, ...order.flatMap((entry) => owned.get(entry) ?? [])]
    context.board.take(parts)
    return parts
  }
  const headerW = (header: string | undefined) => (header === undefined ? 0 : wordsWidth(context, header, look) + 2)
  const rowsH = (grid: Grid) =>
    Array.from({ length: grid.rows }, (_, row) =>
      Math.max(lineH, ...grid.columns.flatMap((column) => (column[row] === undefined ? [] : [nameH(column[row])]))),
    )
  return { lineH, shape, width, draw, headerW, rowsH }
}

const acrossRows = (entries: readonly Entry[], count: number): Grid => {
  const columns = Array.from({ length: count }, (_, at) => entries.filter((_, index) => index % count === at))
  return { columns, rows: Math.ceil(entries.length / count) }
}

const downColumns = (entries: readonly Entry[], lead: number, rows: number): Grid => {
  const columns: Entry[][] = []
  entries.forEach((entry, at) => {
    const slot = Math.floor((at + lead) / rows)
    columns[slot] = [...(columns[slot] ?? []), entry]
  })
  return { columns, rows }
}

export function legendGrid(
  context: Context,
  entries: readonly Entry[],
  header: string | undefined,
  look: Words,
  room: number,
): Legend | undefined {
  const natural = measured(context, look)
  const fitting = Array.from({ length: entries.length }, (_, at) => acrossRows(entries, entries.length - at)).find(
    (grid) => natural.width(grid) <= room,
  )
  const balanced = fitting && acrossRows(entries, Math.ceil(entries.length / fitting.rows))
  const grid =
    balanced !== undefined && natural.width(balanced) <= room ? balanced : (fitting ?? acrossRows(entries, 1))
  const alone = natural.shape(entries)
  const sized = fitting === undefined ? measured(context, look, room - (alone.w - alone.names)) : natural
  if (sized.headerW(header) > room) return undefined
  const lead = header === undefined ? 0 : natural.lineH + rowGap
  const heights = sized.rowsH(grid)
  const tops = heights.map((_, row) => lead + heights.slice(0, row).reduce((sum, one) => sum + one + rowGap, 0))
  return {
    w: Math.min(room, Math.max(sized.width(grid), sized.headerW(header))),
    h: lead + heights.reduce((sum, one) => sum + one + rowGap, 0) - rowGap,
    place: (x, y) => sized.draw(header, grid, (_, row) => tops[row]!, x, y, entries),
  }
}

export function legendStack(
  context: Context,
  entries: readonly Entry[],
  header: string | undefined,
  look: Words,
  room: number,
): Legend | undefined {
  const sized = measured(context, look)
  const lead = header === undefined ? 0 : 1
  const count = entries.length + lead
  const fits = (pitch: number) => Math.max(1, Math.floor((room - sized.lineH) / pitch) + 1)
  const pitches = pitchGaps.map((gap) => sized.lineH + gap)
  const fewest = Math.ceil(count / Math.max(lead + 1, fits(pitches[pitches.length - 1]!)))
  const pitch = pitches.find((one) => Math.ceil(count / Math.max(lead + 1, fits(one))) === fewest)!
  const rows = Math.ceil(count / fewest)
  if (sized.lineH > room) return undefined
  const grid = downColumns(entries, lead, Math.max(lead + 1, rows))
  return {
    w: Math.max(sized.width(grid), sized.headerW(header)),
    h: (Math.min(count, grid.rows) - 1) * pitch + sized.lineH,
    place: (x, y) =>
      sized.draw(header, grid, (column, row) => (column === 0 ? row + lead : row) * pitch, x, y, entries),
  }
}

export function legendEntries(context: Context): Entry[] {
  const { chart } = context
  return chart.series.length > 1
    ? chart.series.map((series, index) => ({ name: series.name, color: seriesColor(context, index) }))
    : []
}
