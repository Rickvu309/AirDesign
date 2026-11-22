import { paintKind, type PaintElement } from "@airdesign/pptx"
import {
  unshownFill,
  type CanvasCrop,
  type CanvasElement,
  type CanvasLayer,
  type CanvasLine,
  type CanvasOutline,
  type CanvasText,
} from "@airdesign/render"
import type { CanvasShape } from "@/canvas-source"
import { fillPlan, type PlanLayer } from "@/fill-plan"
import { pictureLayer, type PictureSource } from "@/picture-fill"
import { canvasEffects } from "@/canvas-effects"
import { cssColor, cssGradient, visibleFill } from "@/paint-css"
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
  readonly editable: boolean
  readonly movable: boolean
}

export function movableRow(ctx: RowPaint): boolean {
  return (ctx.shape?.movable ?? false) && ctx.row.box !== null
}

type Picture = NonNullable<CanvasLayer["picture"]>

function toneOf(image: NonNullable<PaintElement["image"]>): Picture {
  const recolor = image.recolor
  return {
    ...(image.alpha === undefined ? {} : { opacity: image.alpha }),
    ...(recolor !== undefined && "grayscale" in recolor ? { grayscale: true } : {}),
    ...(recolor !== undefined && "duotone" in recolor
      ? { duotone: [cssColor(recolor.duotone[0]), cssColor(recolor.duotone[1])] as const }
      : {}),
    ...(image.blur === undefined ? {} : { blur: image.blur }),
    ...(image.overlay === undefined ? {} : { overlay: cssColor(image.overlay) }),
  }
}

function canvasLayer(
  layer: Exclude<PlanLayer, { readonly kind: "inner" }>,
  src: PictureSource,
  above: boolean,
): CanvasLayer {
  if (layer.kind === "color") {
    const color = cssColor(layer.color)
    return { background: above ? `linear-gradient(${color}, ${color})` : color }
  }
  if (layer.kind === "gradient") return { background: cssGradient(layer.gradient) }
  const url = src(layer.image)
  const background = url === null ? null : pictureLayer(layer.image, url, src.dimensions?.(layer.image))
  return { background: background ?? unshownFill, picture: toneOf(layer.image) }
}

function plain(layer: CanvasLayer): boolean {
  return layer.picture === undefined || Object.keys(layer.picture).length === 0
}

function layersOf(row: PaintElement, src: PictureSource): readonly CanvasLayer[] | null {
  const plan = fillPlan(row)
  if (row.stack === undefined && !plan.some((layer) => layer.kind === "image")) return null
  return plan.flatMap((layer, at) => (layer.kind === "inner" ? [] : [canvasLayer(layer, src, at > 0)]))
}

function cropOf(row: PaintElement, src: PictureSource): { readonly crop?: CanvasCrop } {
  if (row.kind !== "p:pic") return {}
  const images = fillPlan(row).flatMap((layer) => (layer.kind === "image" && !layer.placed.tile ? [layer] : []))
  const [only] = images
  if (images.length !== 1 || only === undefined || only.placed.tile) return {}
  const url = src(only.image)
  if (url === null) return {}
  const { x, y, width, height } = only.placed
  return { crop: { url, image: { x, y, width, height } } }
}

function framedFill(layers: readonly CanvasLayer[] | null): string | null | undefined {
  if (layers === null || !layers.every(plain)) return undefined
  return layers.length === 0
    ? null
    : layers
        .map((layer) => layer.background)
        .toReversed()
        .join(", ")
}

function labelOf(row: PaintElement): { readonly label?: string } {
  const label = row.alt ?? (row.kind === "p:pic" ? row.name : undefined)
  return label === undefined ? {} : { label }
}

function heldText(text: CanvasText | null, shape: CanvasShape | undefined): CanvasText | null {
  if (text?.fit === undefined || shape?.refit === true) return text
  return { ...text, fit: { ...text.fit, held: true } }
}

export function elementFrom(ctx: RowPaint, spec: DrawnSpec): CanvasElement {
  const { key, row, shape } = ctx
  const unshown = unshownText(row, ctx.src)
  const effects = canvasEffects(row.effects)
  const painted = layersOf(row, ctx.src)
  const framed = framedFill(painted)
  const layers = framed === undefined ? painted : null
  return {
    ...labelOf(row),
    ...(layers === null ? {} : { layers }),
    key,
    id: shape?.id ?? null,
    kind: row.kind === "p:pic" ? "picture" : (shape?.kind ?? paintKind(row.kind)),
    box: row.box,
    editable: spec.editable,
    movable: spec.movable,
    placeholder: row.placeholder !== null,
    ...(row.prompt ? { prompt: row.prompt } : {}),
    ...(unshown === null ? {} : { unshownText: unshown }),
    filled: painted === null ? visibleFill(row.fill) : painted.length > 0,
    fill: framed === undefined ? (layers === null ? spec.fill : null) : framed,
    line: spec.line,
    ...(effects === undefined ? {} : { effects }),
    outline: spec.outline,
    ...(spec.geometry === undefined ? {} : { geometry: spec.geometry }),
    text: heldText(spec.text, shape),
    ...cropOf(row, ctx.src),
  }
}
