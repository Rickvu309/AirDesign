import type { CanvasElement } from "@airdesign/render"
import { elementFrom, movableRow, type RowPaint } from "@/editing/canvas-element"
import { canvasLine, geometryOf, outlineOf } from "@/editing/canvas-shape"
import { canvasText } from "@/editing/canvas-text"
import { paintedFill } from "@/editing/paint-css"

export function paintPreset(ctx: RowPaint): CanvasElement {
  const outline = outlineOf(ctx.row)
  return elementFrom(ctx, {
    outline,
    fill: paintedFill(ctx.row, outline, ctx.src),
    line: canvasLine(ctx.row.line),
    text: canvasText(ctx.row.text, ctx.src),
    geometry: geometryOf(ctx.row),
    editable: ctx.shape?.editable ?? false,
    movable: movableRow(ctx),
  })
}
