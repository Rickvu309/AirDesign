import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { cellsOf, gridOf, type Grid } from "./table-grid.js"
import { emptiedCells, frameGrowth, freshId } from "./table-route.js"

const emptyBytes = new Uint8Array(0)

function columnOf(grid: Grid, column: number, fewest: number): { width: MarkupElement; size: number } {
  if (grid.merged) throw new Error("tbl.merged")
  if (grid.columns < fewest) throw new Error("a:gridCol")
  const width = Number.isInteger(column) ? grid.widths[column - 1] : undefined
  const size = width?.attributes.find((item) => item.name === "w")?.value ?? ""
  if (width === undefined || !/^\d+$/.test(size) || !Number.isSafeInteger(Number(size))) throw new Error("a:gridCol")
  return { width, size: Number(size) }
}

function cellAt(grid: Grid, row: MarkupElement, column: number): MarkupElement {
  const cell = cellsOf(grid, row)[column - 1]
  if (cell === undefined) throw new Error("a:tc")
  return cell
}

export function addColumn(bytes: Uint8Array, shape: string, column: number, place: "before" | "after"): Uint8Array {
  const grid = gridOf(bytes, shape)
  const { width, size } = columnOf(grid, column, 1)
  const at = (element: MarkupElement) => (place === "before" ? element.start : element.end)
  const copy = (element: MarkupElement, extra: readonly ByteEdit[]) =>
    spliceBytes(bytes.slice(element.start, element.end), extra)
  const edits: ByteEdit[] = [
    ...frameGrowth(grid.elements, grid.table, "cx", size),
    { start: at(width), end: at(width), next: copy(width, freshId(grid.elements, width, "a16:colId")) },
    ...grid.rows.map((row) => {
      const cell = cellAt(grid, row, column)
      return { start: at(cell), end: at(cell), next: emptiedCells(bytes, grid.elements, cell) }
    }),
  ]
  return spliceBytes(bytes, edits)
}

export function removeColumn(bytes: Uint8Array, shape: string, column: number): Uint8Array {
  const grid = gridOf(bytes, shape)
  const { width, size } = columnOf(grid, column, 2)
  const cut = (element: MarkupElement) => ({ start: element.start, end: element.end, next: emptyBytes })
  return spliceBytes(bytes, [
    ...frameGrowth(grid.elements, grid.table, "cx", -size),
    cut(width),
    ...grid.rows.map((row) => cut(cellAt(grid, row, column))),
  ])
}
