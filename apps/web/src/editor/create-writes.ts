import { type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import type { Point, SlideGeometry } from "./slide-geometry"
import { propOf } from "@airdesign/doom"
import { placementRules } from "@airdesign/taste"

export type Drawn = "frame" | "rectangle" | "ellipse" | "line" | "arrow" | `preset:${string}`
type Slot = { readonly id: doom.NodeId; readonly at: OrderKey }
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

const solid = (color: doom.Color): doom.Paint => ({ kind: "solid", color })
const themed = (color: doom.ColorVar): doom.Paint => solid({ var: color })
const quiet = solid({ var: "background2", tint: -0.06 })
const ink = themed("text")
const upright = { rotation: 0, flipH: false, flipV: false } as const
const plainStroke: doom.StrokeStyle = { weight: 4, align: "center", dash: "solid" }

export type Drawing = {
  readonly id: doom.NodeId
  readonly parent: Slot
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

export function drawWrites(drawing: Drawing): readonly doom.Write[] {
  const { id, parent, kind } = drawing
  const head: doom.Write[] = [
    { node: id, prop: "type", value: kind === "frame" ? "frame" : "shape" },
    { node: id, prop: "parent", value: parent },
    { node: id, prop: "name", value: drawnNames[kind] ?? "Shape" },
  ]
  if (isLine(kind)) {
    const [start, end] = endsOf(drawing)
    return [
      ...head,
      {
        node: id,
        prop: "geometry",
        value: {
          kind: "line",
          start,
          end,
          route: "straight",
          arrows: kind === "arrow" ? ["none", "arrow"] : ["none", "none"],
        },
      },
      { node: id, prop: "strokes", value: [ink] },
      { node: id, prop: "stroke", value: plainStroke },
    ]
  }
  const box = { ...boxOf(drawing), ...upright }
  if (kind === "frame")
    return [
      ...head,
      { node: id, prop: "box", value: box },
      { node: id, prop: "fills", value: [themed("background2")] },
      { node: id, prop: "clip", value: true },
    ]
  return [
    ...head,
    { node: id, prop: "box", value: box },
    {
      node: id,
      prop: "geometry",
      value:
        kind === "ellipse"
          ? { kind: "ellipse" }
          : kind.startsWith("preset:")
            ? { kind: "preset", name: kind.slice("preset:".length) }
            : { kind: "rect" },
    },
    { node: id, prop: "fills", value: [quiet] },
  ]
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

export function iconWrites(
  view: doom.Doom,
  id: doom.NodeId,
  parent: Slot,
  name: string,
  inside: Size,
  anchor?: Box,
): readonly doom.Write[] {
  const at = iconAt(view, parent.id, inside, anchor)
  return [
    { node: id, prop: "type", value: "shape" },
    { node: id, prop: "parent", value: parent },
    { node: id, prop: "name", value: "Icon" },
    { node: id, prop: "box", value: { x: at.x, y: at.y, w: at.w, h: at.h, ...upright } },
    { node: id, prop: "geometry", value: { kind: "icon", name: `lucide/${name}` } },
    { node: id, prop: "strokes", value: [themed("text")] },
    { node: id, prop: "stroke", value: { weight: iconSide / 12, align: "center", dash: "solid" } },
  ]
}

export function iconSwapWrites(
  view: doom.Doom,
  ids: readonly doom.NodeId[],
  name: string,
): readonly doom.Write[] | null {
  const swaps = ids.flatMap((id) => {
    const geometry = propOf(view.nodes.get(id), "geometry")
    return geometry?.kind === "icon"
      ? [{ node: id, prop: "geometry" as const, value: { ...geometry, name: `lucide/${name}` } }]
      : []
  })
  return ids.length === 0 || swaps.length !== ids.length ? null : swaps
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
