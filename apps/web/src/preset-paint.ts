import type { CanvasElement } from "@airdesign/render"
import { elementFrom, movableRow, type RowPaint } from "@/canvas-element"
import { canvasLine, geometryOf, outlineOf } from "@/canvas-shape"
import { canvasText } from "@/canvas-text"
import { paintedFill } from "@/paint-css"

export function paintPreset(ctx: RowPaint): CanvasElement {
  const outline = outlineOf(ctx.row)
  return elementFrom(ctx, {
    outline,
    fill: paintedFill(ctx.row, outline, ctx.src),
    line: canvasLine(ctx.row.line),
    text: canvasText(ctx.row.text),
    geometry: geometryOf(ctx.row),
    table: undefined,
    editable: ctx.shape?.editable ?? false,
    movable: movableRow(ctx),
  })
}
