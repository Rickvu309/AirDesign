import { paintKind, type PaintElement } from "@airdesign/pptx"
import type { CanvasElement, CanvasLine, CanvasOutline, CanvasTable, CanvasText } from "@airdesign/render"
import type { CanvasShape } from "@/canvas-source"
import type { PictureSource } from "@/picture-fill"
import { canvasEffects } from "@/canvas-effects"
import { cssColor, visibleFill } from "@/paint-css"
import { unshownText } from "@/unshown-text"

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

type Picture = NonNullable<CanvasElement["picture"]>

function pictureOf(row: PaintElement): { readonly picture?: Picture } {
  const image = row.image
  if (image === null || (image.alpha === undefined && image.recolor === undefined)) return {}
  const recolor = image.recolor
  const picture: Picture = {
    ...(image.alpha === undefined ? {} : { opacity: image.alpha }),
    ...(recolor !== undefined && "grayscale" in recolor ? { grayscale: true } : {}),
    ...(recolor !== undefined && "duotone" in recolor
      ? { duotone: [cssColor(recolor.duotone[0]), cssColor(recolor.duotone[1])] as const }
      : {}),
  }
  return { picture }
}

function labelOf(row: PaintElement): { readonly label?: string } {
  const label = row.alt ?? (row.kind === "p:pic" ? row.name : undefined)
  return label === undefined ? {} : { label }
}

function heldText(text: CanvasText | null, shape: CanvasShape | undefined): CanvasText | null {
  if (text?.fit?.kind !== "shrink" || shape?.refit === true) return text
  return { ...text, fit: { ...text.fit, held: true } }
}

export function elementFrom(ctx: RowPaint, spec: DrawnSpec): CanvasElement {
  const { key, row, shape } = ctx
  const unshown = unshownText(row, ctx.src)
  const effects = canvasEffects(row.effects)
  return {
    ...labelOf(row),
    ...pictureOf(row),
    key,
    id: shape?.id ?? null,
    kind: shape?.kind ?? paintKind(row.kind),
    box: row.box,
    editable: spec.editable,
    movable: spec.movable,
    placeholder: row.placeholder !== null,
    ...(row.prompt ? { prompt: row.prompt } : {}),
    ...(unshown === null ? {} : { unshownText: unshown }),
    filled: visibleFill(row.fill),
    fill: spec.fill,
    line: spec.line,
    ...(effects === undefined ? {} : { effects }),
    outline: spec.outline,
    ...(spec.geometry === undefined ? {} : { geometry: spec.geometry }),
    text: heldText(spec.text, shape),
    ...(spec.table === undefined ? {} : { table: spec.table }),
  }
}
