import type { PaintTable } from "@airdesign/pptx"
import type { CanvasElement, CanvasTable } from "@airdesign/render"
import { elementFrom, movableRow, type RowPaint } from "@/canvas-element"
import { canvasLine, geometryOf, outlineOf } from "@/canvas-shape"
import { canvasText } from "@/canvas-text"
import { fillOf, paintedFill } from "@/paint-css"
import type { PictureSource } from "@/picture-fill"

export function canvasTable(table: PaintTable | undefined, src: PictureSource): CanvasTable | undefined {
  if (table === undefined) return undefined
  return {
    frame: table.frame,
    columns: table.columns,
    rows: table.rows.map((row) => ({
      height: row.height,
      cells: row.cells.map((cell) => ({
        gridSpan: cell.gridSpan,
        rowSpan: cell.rowSpan,
        hMerge: cell.hMerge,
        vMerge: cell.vMerge,
        fill: fillOf(cell.fill, src),
        borders: {
          left: canvasLine(cell.borders.left),
          right: canvasLine(cell.borders.right),
          top: canvasLine(cell.borders.top),
          bottom: canvasLine(cell.borders.bottom),
        },
        text: canvasText(cell.text),
      })),
    })),
  }
}

export function paintTable(ctx: RowPaint): CanvasElement {
  const outline = outlineOf(ctx.row)
  return elementFrom(ctx, {
    outline,
    fill: paintedFill(ctx.row, outline, ctx.src),
    line: canvasLine(ctx.row.line),
    text: canvasText(ctx.row.text, ctx.src),
    geometry: geometryOf(ctx.row),
    table: canvasTable(ctx.row.table, ctx.src),
    editable: ctx.shape?.editable ?? false,
    movable: movableRow(ctx),
  })
}
