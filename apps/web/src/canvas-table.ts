import type { PaintFill, PaintLine, PaintTable, PaintText } from "@airdesign/pptx"
import type { CanvasLine, CanvasTable, CanvasText } from "@airdesign/render"

export function canvasTable(
  table: PaintTable | undefined,
  fillOf: (fill: PaintFill | null) => string | null,
  lineOf: (line: PaintLine | null) => CanvasLine | null,
  textOf: (text: PaintText | null) => CanvasText | null,
): CanvasTable | undefined {
  if (table === undefined) return undefined
  return {
    columns: table.columns,
    rows: table.rows.map((row) => ({
      height: row.height,
      cells: row.cells.map((cell) => ({
        gridSpan: cell.gridSpan,
        rowSpan: cell.rowSpan,
        hMerge: cell.hMerge,
        vMerge: cell.vMerge,
        fill: fillOf(cell.fill),
        borders: {
          left: lineOf(cell.borders.left),
          right: lineOf(cell.borders.right),
          top: lineOf(cell.borders.top),
          bottom: lineOf(cell.borders.bottom),
        },
        text: textOf(cell.text),
      })),
    })),
  }
}
