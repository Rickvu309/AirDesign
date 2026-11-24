import {
  type End,
  type Measure,
  type NodeId,
  type Props,
  type Theme,
  isRefusal,
  nodeId,
  props,
  siteSpot,
} from "../index.js"
import { type Reader, finite, literal, object, reject } from "../read-kit.js"
import type { Expr } from "./expression.js"
import type { Emission } from "./spec.js"
import { color, id, isList, numeric, string, type Value } from "./values.js"

export type PartKey = readonly [string, ...string[]]
type ShapeProps = Pick<Props, "name" | "box" | "geometry"> &
  Partial<Pick<Props, "fills" | "strokes" | "stroke" | "text">>
export type ComponentNode = {
  readonly id: NodeId
  readonly key: PartKey
  readonly type: "shape"
  readonly props: ShapeProps
}
export type ComponentTree = {
  readonly id: NodeId
  readonly key: readonly ["root"]
  readonly type: "frame"
  readonly props: Pick<Props, "name" | "box">
  readonly children: readonly ComponentNode[]
}

const prop = <K extends keyof typeof props>(key: K, raw: unknown): Props[K] => {
  const value = props[key].read(raw)
  return isRefusal(value) ? reject(value.refused === "limit" ? "limit" : "shape") : value
}

const coordinate = finite(-1_000_000, 1_000_000)
const size = finite(0, 1_000_000)
export const readFrame: Reader<{ readonly x: number; readonly y: number; readonly w: number; readonly h: number }> =
  object({ x: coordinate, y: coordinate, w: size, h: size })

function box(x: unknown, y: unknown, w: unknown, h: unknown): Props["box"] {
  const left = coordinate(x)
  const top = coordinate(y)
  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.round(left + size(w)) - Math.round(left),
    h: Math.round(top + size(h)) - Math.round(top),
    rotation: 0,
    flipH: false,
    flipV: false,
  }
}

function keyOf(raw: unknown): PartKey {
  if (!isList(raw) || raw.length === 0) return reject()
  if (raw.length > 5) return reject("limit")
  return [id(raw[0]), ...raw.slice(1).map(id)]
}

const readPoint = object({ x: coordinate, y: coordinate })
const readSite = object({ key: keyOf, site: literal(["t", "r", "b", "l", "c"]) })

type PartEnd = ReturnType<typeof readPoint> | ReturnType<typeof readSite>
const endpoint = (raw: Value): PartEnd =>
  raw !== null && typeof raw === "object" && Object.hasOwn(raw, "key") ? readSite(raw) : readPoint(raw)

type Line = {
  readonly start: PartEnd
  readonly end: PartEnd
  readonly route: Extract<Props["geometry"], { kind: "line" }>["route"]
  readonly arrow: Extract<Props["geometry"], { kind: "line" }>["arrows"][1]
  readonly strokes: Props["strokes"]
  readonly stroke: Props["stroke"]
}

export type PreparedPart = { readonly key: PartKey } & (
  | { readonly kind: "shape"; readonly props: ShapeProps }
  | { readonly kind: "line"; readonly line: Line }
)

export function preparePart(
  emit: Emission,
  read: (expr: Expr) => Value,
  measure: Measure,
  theme: Theme,
): PreparedPart | undefined {
  const key = keyOf(read(emit.key))
  if (emit.kind === "line") {
    return {
      key,
      kind: "line",
      line: {
        start: endpoint(read(emit.start)),
        end: endpoint(read(emit.end)),
        route: literal(["straight", "elbow", "curve"])(read(emit.route)),
        arrow: literal(["none", "arrow", "triangle", "circle"])(read(emit.arrow)),
        strokes: [{ kind: "solid", color: color(read(emit.color)) }],
        stroke: prop("stroke", { weight: read(emit.width), align: "center", dash: "solid" }),
      },
    }
  }
  const position = box(read(emit.x), read(emit.y), read(emit.w), read(emit.h))
  const shared = { name: key.join(" / "), box: position, geometry: { kind: "rect" } } as const
  if (emit.kind === "rect")
    return { key, kind: "shape", props: { ...shared, fills: [{ kind: "solid", color: color(read(emit.fill)) }] } }

  const chars = string(read(emit.chars))
  const alignment = literal(["left", "center", "right", "justify"])(read(emit.align))
  const ink = color(read(emit.color))
  const text = prop("text", {
    chars,
    spans: chars === "" ? [] : [{ end: chars.length, color: ink }],
    paras: chars.split("\n").map(() => ({ align: alignment })),
    style: read(emit.style),
    resize: "fixed",
    alignV: read(emit.alignV),
  })
  if (emit.fit === "omit") {
    const measured = measure(text, theme, null)
    if (numeric(measured.w) > position.w || numeric(measured.h) > position.h) return undefined
  }
  return { key, kind: "shape", props: { ...shared, text } }
}

const rootKey = ["root"] as const
const keyString = (key: PartKey): string => JSON.stringify(key)

export function treeOf(
  name: string,
  frame: ReturnType<typeof readFrame>,
  parts: readonly PreparedPart[],
): ComponentTree {
  const seen = new Map<string, { readonly id: NodeId; readonly part: PreparedPart }>()
  for (const [index, part] of parts.entries()) {
    const key = keyString(part.key)
    if (key === keyString(rootKey) || seen.has(key)) return reject()
    seen.set(key, { id: nodeId(`component:${index + 2}`), part })
  }

  const resolve = (end: PartEnd): { readonly end: End; readonly x: number; readonly y: number } => {
    if (!("key" in end)) {
      const point = { x: Math.round(end.x), y: Math.round(end.y) }
      return { ...point, end: point }
    }
    const target = seen.get(keyString(end.key))
    if (target === undefined || target.part.kind !== "shape") return reject()
    const { box, geometry } = target.part.props
    const spot = siteSpot(geometry, box.w, box.h, end.site)
    return { x: box.x + spot.x, y: box.y + spot.y, end: { node: target.id, site: end.site } }
  }

  const children: ComponentNode[] = []
  for (const { id, part } of seen.values()) {
    const node = { type: "shape", id, key: part.key } as const
    if (part.kind === "shape") {
      children.push({ ...node, props: part.props })
      continue
    }
    const { start, end, route, arrow, strokes, stroke } = part.line
    const a = resolve(start)
    const b = resolve(end)
    children.push({
      ...node,
      props: {
        name: part.key.join(" / "),
        box: box(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
        geometry: { kind: "line", start: a.end, end: b.end, route, arrows: ["none", arrow] },
        strokes,
        stroke,
      },
    })
  }
  return {
    id: nodeId("component:1"),
    type: "frame",
    key: rootKey,
    props: { name, box: box(frame.x, frame.y, frame.w, frame.h) },
    children,
  }
}
