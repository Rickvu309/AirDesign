import * as doom from "@airdesign/doom"
import type { Point, SlideGeometry } from "@/editing/slide-geometry"
import { propOf } from "@airdesign/doom"
import { placementRules } from "@airdesign/taste"

export type Drawn = "frame" | "rectangle" | "ellipse" | "line" | "arrow" | `preset:${string}`
type Size = { readonly w: number; readonly h: number }

export const drawnNames: Readonly<Record<string, string>> = {
  frame: "Frame",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  arrow: "Arrow",
}

const clickSizes: Readonly<Record<string, Size>> = {
  frame: { w: 480, h: 270 },
  line: { w: 100, h: 0 },
  arrow: { w: 100, h: 0 },
}

const squareSize: Size = { w: 100, h: 100 }
const sizeOf = (kind: Drawn): Size => clickSizes[kind] ?? squareSize
const isLine = (kind: Drawn) => kind === "line" || kind === "arrow"

const quiet = "background2-6"
const lineWeight = 4

export type Drawing = {
  readonly parent: doom.NodeId
  readonly kind: Drawn
  readonly from: Point
  readonly to: Point | null
  readonly square: boolean
  readonly center: boolean
}

function boxOf(drawing: Drawing): { x: number; y: number; w: number; h: number } {
  const { from, to, square, center, kind } = drawing
  if (to === null) return { x: Math.round(from.x), y: Math.round(from.y), ...sizeOf(kind) }
  let w = Math.abs(to.x - from.x)
  let h = Math.abs(to.y - from.y)
  if (square) w = h = Math.max(w, h)
  const left = to.x < from.x ? from.x - w : from.x
  const top = to.y < from.y ? from.y - h : from.y
  if (center)
    return {
      x: Math.round(from.x - w),
      y: Math.round(from.y - h),
      w: Math.max(1, Math.round(w * 2)),
      h: Math.max(1, Math.round(h * 2)),
    }
  return { x: Math.round(left), y: Math.round(top), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
}

function endsOf(drawing: Drawing): readonly [Point, Point] {
  const { from, to, square, center } = drawing
  let dx = to === null ? sizeOf(drawing.kind).w : to.x - from.x
  let dy = to === null ? 0 : to.y - from.y
  if (square && to !== null) {
    const step = Math.PI / 4
    const angle = Math.round(Math.atan2(dy, dx) / step) * step
    const length = Math.hypot(dx, dy)
    dx = Math.cos(angle) * length
    dy = Math.sin(angle) * length
  }
  const round = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) })
  return center
    ? [round({ x: from.x - dx, y: from.y - dy }), round({ x: from.x + dx, y: from.y + dy })]
    : [round(from), round({ x: from.x + dx, y: from.y + dy })]
}

export function drawIntent(drawing: Drawing): doom.Intent {
  const { parent, kind } = drawing
  const name = drawnNames[kind] ?? "Shape"
  if (isLine(kind)) {
    const [from, to] = endsOf(drawing)
    return {
      op: "insert",
      kind: "line",
      parent,
      name,
      from,
      to,
      arrow: kind === "arrow",
      stroke: "text",
      strokeWidth: lineWeight,
    }
  }
  const box = boxOf(drawing)
  if (kind === "frame") return { op: "insert", kind: "frame", parent, name, box, fill: "background2", clip: true }
  const shape = kind === "rectangle" ? "rect" : kind.startsWith("preset:") ? kind.slice("preset:".length) : kind
  return { op: "insert", kind: "shape", parent, name, box, shape, fill: quiet, radius: 0 }
}

export function centeredIn(inside: Size, size: Size): { readonly x: number; readonly y: number } {
  return { x: Math.round((inside.w - size.w) / 2), y: Math.round((inside.h - size.h) / 2) }
}

type Box = Size & { readonly x: number; readonly y: number }

const iconSide = 120

const fits = (area: Box, least: Size) => area.w >= least.w && area.h >= least.h

function placed(inside: Size, size: Size, at: { readonly x: number; readonly y: number }): Box {
  const along = (value: number, span: number, room: number) => Math.min(Math.max(0, value), Math.max(0, room - span))
  return { x: along(at.x, size.w, inside.w), y: along(at.y, size.h, inside.h), ...size }
}

function onTop(inside: Size, size: Size, anchor: Box | undefined): Box {
  if (anchor === undefined) return placed(inside, size, centeredIn(inside, size))
  const nudge = doom.gapFor(inside.w, placementRules)
  return placed(inside, size, { x: anchor.x + nudge, y: anchor.y + nudge })
}

function openArea(view: doom.Doom, parent: doom.NodeId, inside: Size, least: Size, anchor: Box | undefined): Box {
  const content = doom.contentAreaOf(view, parent, placementRules)
  if (content !== undefined && fits(content, least)) return content
  return onTop(inside, least, anchor)
}

function iconAt(view: doom.Doom, parent: doom.NodeId, inside: Size, anchor: Box | undefined): Box {
  const least = { w: iconSide, h: iconSide }
  const area = openArea(view, parent, inside, least, anchor)
  const at = centeredIn(area, least)
  return { x: area.x + at.x, y: area.y + at.y, ...least }
}

export function iconIntent(
  view: doom.Doom,
  parent: doom.NodeId,
  name: string,
  inside: Size,
  anchor?: Box,
): doom.Intent {
  const box = iconAt(view, parent, inside, anchor)
  return {
    op: "insert",
    kind: "icon",
    parent,
    name: "Icon",
    icon: name,
    box,
    stroke: "text",
    strokeWidth: iconSide / 12,
  }
}

export function iconSwapIntents(
  view: doom.Doom,
  ids: readonly doom.NodeId[],
  name: string,
): readonly doom.Intent[] | null {
  const icons = ids.filter((id) => propOf(view.nodes.get(id), "geometry")?.kind === "icon")
  return ids.length === 0 || icons.length !== ids.length
    ? null
    : icons.map((target) => ({ op: "update", target, icon: name }))
}

export function insertionTarget(
  view: doom.Doom,
  {
    slide,
    size,
    geometry,
    selected,
  }: {
    readonly slide: doom.NodeId
    readonly size: Size
    readonly geometry: SlideGeometry
    readonly selected: readonly doom.NodeId[]
  },
) {
  const [only] = selected
  const placed = selected.length === 1 && only !== undefined ? geometry.byId.get(only) : undefined
  const stored = placed === undefined ? undefined : view.nodes.get(placed.id)
  if (placed !== undefined && stored?.type === "frame") {
    return { parent: placed.id, inside: placed.node.box, anchor: undefined }
  }
  const anchor =
    placed === undefined || placed.parent === null
      ? placed?.node.box
      : { ...placed.node.box, x: placed.bounds.left, y: placed.bounds.top }
  return { parent: slide, inside: size, anchor }
}
