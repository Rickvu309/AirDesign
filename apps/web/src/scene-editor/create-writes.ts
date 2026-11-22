import type { OrderKey, scene } from "@airdesign/document"
import { shapeFill, shapeStroke } from "@/editor/tool-panels-art"
import type { Point } from "./slide-geometry"

export type Drawn = "frame" | "rectangle" | "ellipse" | "line" | "arrow" | `preset:${string}`
type Slot = { readonly id: scene.NodeId; readonly at: OrderKey }
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

const solid = (color: scene.Color): scene.Paint => ({ kind: "solid", color })
const themed = (color: scene.ColorVar): scene.Paint => solid({ var: color })
const blue = solid(shapeFill.toLowerCase() as scene.Hex)
const edge = solid(shapeStroke.toLowerCase() as scene.Hex)
const upright = { rotation: 0, flipH: false, flipV: false } as const
const plainStroke: scene.StrokeStyle = { weight: 4, align: "center", dash: "solid" }

export type Drawing = {
  readonly id: scene.NodeId
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

export function drawWrites(drawing: Drawing): readonly scene.Write[] {
  const { id, parent, kind } = drawing
  const head: scene.Write[] = [
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
      { node: id, prop: "strokes", value: [edge] },
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
    { node: id, prop: "fills", value: [blue] },
    { node: id, prop: "strokes", value: [edge] },
    { node: id, prop: "stroke", value: { weight: 2, align: "inside", dash: "solid" } },
  ]
}

export function centeredIn(inside: Size, size: Size): { readonly x: number; readonly y: number } {
  return { x: Math.round((inside.w - size.w) / 2), y: Math.round((inside.h - size.h) / 2) }
}

export function iconWrites(id: scene.NodeId, parent: Slot, name: string, inside: Size): readonly scene.Write[] {
  const side = 120
  return [
    { node: id, prop: "type", value: "shape" },
    { node: id, prop: "parent", value: parent },
    { node: id, prop: "name", value: "Icon" },
    { node: id, prop: "box", value: { ...centeredIn(inside, { w: side, h: side }), w: side, h: side, ...upright } },
    { node: id, prop: "geometry", value: { kind: "icon", name: `lucide/${name}` } },
    { node: id, prop: "strokes", value: [themed("text")] },
    { node: id, prop: "stroke", value: { weight: side / 12, align: "center", dash: "solid" } },
  ]
}

const sampleCharts: Readonly<Record<scene.Chart["kind"], scene.Chart>> = {
  column: {
    kind: "column",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [{ name: "Revenue", values: [12, 19, 15, 24] }],
    labels: true,
  },
  bar: {
    kind: "bar",
    categories: ["North", "South", "East", "West"],
    series: [{ name: "Revenue", values: [24, 15, 19, 12] }],
    labels: true,
  },
  line: {
    kind: "line",
    categories: ["Jan", "Feb", "Mar", "Apr", "May"],
    series: [{ name: "Users", values: [8, 12, 11, 17, 21] }],
  },
  pie: {
    kind: "pie",
    categories: ["Direct", "Partners", "Online", "Other"],
    series: [{ name: "Share", values: [45, 25, 20, 10] }],
    labels: true,
  },
  stacked: {
    kind: "stacked",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "Product", values: [8, 11, 9, 14] },
      { name: "Services", values: [4, 8, 6, 10] },
    ],
  },
}

export function chartWrites(
  id: scene.NodeId,
  parent: Slot,
  inside: Size,
  kind: scene.Chart["kind"] = "column",
): readonly scene.Write[] {
  const size = { w: Math.min(1040, Math.round(inside.w * 0.6)), h: Math.min(580, Math.round(inside.h * 0.6)) }
  return [
    { node: id, prop: "type", value: "frame" },
    { node: id, prop: "parent", value: parent },
    { node: id, prop: "name", value: "Chart" },
    { node: id, prop: "box", value: { ...centeredIn(inside, size), ...size, ...upright } },
    { node: id, prop: "chart", value: sampleCharts[kind] },
  ]
}
