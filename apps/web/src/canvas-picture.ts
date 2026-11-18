import type { CanvasElement } from "@airdesign/render"
import { elementFrom, movableRow, type RowPaint } from "@/canvas-element"
import { canvasLine, geometryOf, outlineOf } from "@/canvas-shape"
import { canvasText } from "@/canvas-text"
import { fillOf, pictureOver } from "@/paint-css"

export function paintPicture(ctx: RowPaint): CanvasElement {
  const outline = outlineOf(ctx.row)
  const over = pictureOver(ctx.row, ctx.src)
  return elementFrom(ctx, {
    outline,
    fill: over ?? (outline === "line" ? null : fillOf(ctx.row.fill, ctx.src)),
    line: canvasLine(ctx.row.line),
    text: canvasText(ctx.row.text, ctx.src),
    geometry: geometryOf(ctx.row),
    table: undefined,
    editable: ctx.shape?.editable ?? false,
    movable: movableRow(ctx),
  })
}
