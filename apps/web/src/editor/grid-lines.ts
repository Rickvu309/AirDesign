import type { NodeId } from "@airdesign/doom"

export type GridSize = { readonly width: number; readonly height: number }
export type GridRect = GridSize & { readonly left: number; readonly top: number }
export type GridCard = GridRect & { readonly id: NodeId; readonly index: number; readonly group: number }
export type GridLayout = GridSize & { readonly cards: readonly GridCard[] }

const numberAboveGap = 88
const haloBand = 30
const mostColumns = 10

export function gridBaseColumns(count: number): number {
  return Math.min(mostColumns, Math.max(4, Math.ceil(Math.sqrt(Math.max(0, count) * 1.5))))
}

function packed(lengths: readonly number[], columns: number): number {
  return lengths.reduce((total, length) => total + Math.max(1, Math.ceil(length / columns)), 0)
}

export function gridWrapColumns(lengths: readonly number[]): number {
  const base = gridBaseColumns(lengths.reduce((total, length) => total + length, 0))
  if (lengths.length < 2 || lengths.every((length) => length <= base)) return base
  let columns = base
  let lines = packed(lengths, base)
  for (let next = base + 1; next <= mostColumns; next += 1) {
    const candidate = packed(lengths, next)
    if (candidate < lines) {
      columns = next
      lines = candidate
    }
  }
  return columns
}

export function gridSpacing(slide: GridSize) {
  const column = slide.width * 0.13
  const group = slide.height * 0.57
  const inset = slide.height / 30
  const needed = (haloBand * group) / numberAboveGap - inset
  const line = Math.max(column, needed)
  return { column, group, line: line < group ? line : group / 2, inset }
}

export function gridLayout(groups: readonly (readonly NodeId[])[], slide: GridSize): GridLayout {
  const filled = groups.filter((group) => group.length > 0)
  const columns = gridWrapColumns(filled.map((group) => group.length))
  const spacing = gridSpacing(slide)
  const cards: GridCard[] = []
  let top = 0
  let widest = 0
  filled.forEach((ids, group) => {
    for (let start = 0; start < ids.length; start += columns) {
      if (cards.length > 0) top += start === 0 ? spacing.group : spacing.line
      const line = ids.slice(start, start + columns)
      widest = Math.max(widest, line.length)
      line.forEach((id, column) =>
        cards.push({
          id,
          index: cards.length,
          group,
          left: column * (slide.width + spacing.column),
          top: top + spacing.inset,
          width: slide.width,
          height: slide.height,
        }),
      )
      top += spacing.inset + slide.height
    }
  })
  return {
    cards,
    width: widest === 0 ? 0 : widest * slide.width + (widest - 1) * spacing.column,
    height: top,
  }
}
