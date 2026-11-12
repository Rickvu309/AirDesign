import { paintKind, type PaintElement } from "@airdesign/pptx"
import type { CanvasElement, CanvasLine, CanvasOutline, CanvasTable, CanvasText } from "@airdesign/render"
import type { CanvasShape } from "@/canvas-source"
import type { PictureSource } from "@/picture-fill"
import { visibleFill } from "@/paint-css"

export type RowPaint = {
  readonly row: PaintElement
  readonly shape: CanvasShape | undefined
  readonly key: string
  readonly src: PictureSource
}

type Geometry = NonNullable<CanvasElement["geometry"]>

export type DrawnSpec = {
  readonly outline: CanvasOutline
  readonly fill: string | null
  readonly line: CanvasLine | null
  readonly text: CanvasText | null
  readonly geometry: Geometry | undefined
  readonly table: CanvasTable | undefined
  readonly editable: boolean
  readonly movable: boolean
}

export function movableRow(ctx: RowPaint): boolean {
  return (ctx.shape?.movable ?? false) && ctx.row.group === null && ctx.row.box !== null
}

export function elementFrom(ctx: RowPaint, spec: DrawnSpec): CanvasElement {
  const { key, row, shape } = ctx
  return {
    key,
    id: shape?.id ?? null,
    kind: shape?.kind ?? paintKind(row.kind),
    box: row.box,
    editable: spec.editable,
    movable: spec.movable,
    placeholder: row.placeholder !== null,
    ...(row.prompt ? { prompt: row.prompt } : {}),
    filled: visibleFill(row.fill),
    fill: spec.fill,
    line: spec.line,
    outline: spec.outline,
    ...(spec.geometry === undefined ? {} : { geometry: spec.geometry }),
    text: spec.text,
    ...(spec.table === undefined ? {} : { table: spec.table }),
  }
}
