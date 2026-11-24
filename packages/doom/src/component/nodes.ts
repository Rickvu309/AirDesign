import {
  type End,
  type Measure,
  type NodeId,
  type Props,
  type Text,
  type Theme,
  isRefusal,
  nodeId,
  props,
  siteSpot,
} from "../index.js"
import { type Reader, finite, literal, naming, object, reject } from "../read-kit.js"
import type { Expr } from "./expression.js"
import type { Emission } from "./spec.js"
import { type Charge, color, id, isList, numeric, string, type Value } from "./values.js"

export type PartKey = readonly [string, ...string[]]
type ShapeProps = Pick<Props, "name" | "box" | "geometry"> &
  Partial<Pick<Props, "fills" | "strokes" | "stroke" | "text">>
export type ComponentNode = {
  readonly id: NodeId
  readonly key: PartKey
  readonly type: "shape"
  readonly props: ShapeProps
}
export type ComponentFinding = {
  readonly kind: "text-fit"
  readonly key: PartKey
  readonly field: string
}
export type ComponentTree = {
  readonly id: NodeId
  readonly key: readonly ["root"]
  readonly type: "frame"
  readonly props: Pick<Props, "name" | "box">
  readonly children: readonly ComponentNode[]
  readonly findings: readonly ComponentFinding[]
}

const prop = <K extends keyof typeof props>(key: K, raw: unknown): Props[K] => {
  const value = props[key].read(raw)
  if (!isRefusal(value)) return value
  const refuse = () => reject(value.refused === "limit" ? "limit" : "shape", value.form ?? `Valid ${key} properties.`)
  return value.field === undefined ? refuse() : naming(value.field, refuse)
}

const coordinate = finite(-1_000_000, 1_000_000)
const size = finite(0, 1_000_000)
export const readFrame: Reader<{ readonly x: number; readonly y: number; readonly w: number; readonly h: number }> =
  object({ x: coordinate, y: coordinate, w: size, h: size })

function box(x: number, y: number, w: number, h: number): Props["box"] {
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(x + w) - Math.round(x),
    h: Math.round(y + h) - Math.round(y),
    rotation: 0,
    flipH: false,
    flipV: false,
  }
}

function keyOf(raw: unknown): PartKey {
  if (!isList(raw) || raw.length === 0) return reject("shape", "A non-empty list of part key segments.")
  if (raw.length > 5) return reject("limit", "At most five part key segments.")
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

export type PreparedPart = { readonly key: PartKey; readonly field: string } & (
  | { readonly kind: "shape"; readonly props: ShapeProps }
  | { readonly kind: "line"; readonly line: Line }
)

type EmissionContext = {
  readonly read: (expr: Expr) => Value
  readonly measure: Measure
  readonly theme: Theme
  readonly charge: Charge
}

const align = literal(["left", "center", "right", "justify"])
const vertical = literal(["top", "center", "bottom"])
const route = literal(["straight", "elbow", "curve"])
const arrow = literal(["none", "arrow", "triangle", "circle"])
const smallerSize = finite(1, 2_000)

export function preparePart(
  emit: Emission,
  field: string,
  { read, measure, theme, charge }: EmissionContext,
): PreparedPart | ComponentFinding | undefined {
  const readField = <T>(name: string, expr: Expr, parse: (value: Value) => T): T =>
    naming(`${field}.${name}`, () => parse(read(expr)))
  const key = readField("key", emit.key, keyOf)
  if (emit.kind === "line") {
    return {
      key,
      field,
      kind: "line",
      line: {
        start: readField("start", emit.start, endpoint),
        end: readField("end", emit.end, endpoint),
        route: readField("route", emit.route, route),
        arrow: readField("arrow", emit.arrow, arrow),
        strokes: [{ kind: "solid", color: readField("color", emit.color, color) }],
        stroke: readField("width", emit.width, (weight) => prop("stroke", { weight, align: "center", dash: "solid" })),
      },
    }
  }
  const position = box(
    readField("x", emit.x, coordinate),
    readField("y", emit.y, coordinate),
    readField("w", emit.w, size),
    readField("h", emit.h, size),
  )
  const shared = { name: key.join(" / "), box: position, geometry: { kind: "rect" } } as const
  if (emit.kind === "rect")
    return {
      key,
      field,
      kind: "shape",
      props: { ...shared, fills: [{ kind: "solid", color: readField("fill", emit.fill, color) }] },
    }

  const chars = readField("chars", emit.chars, (value) => {
    if (typeof value === "string") charge(value.length)
    return string(value)
  })
  const alignment = readField("align", emit.align, align)
  const ink = readField("color", emit.color, color)
  const textStyle = naming(`${field}.style`, () => read(emit.style))
  const alignV = readField("alignV", emit.alignV, vertical)
  const lines = chars.split("\n")
  naming(`${field}.chars`, () => charge(16 * lines.length))
  const text = naming(field, () =>
    prop("text", {
      chars,
      spans: chars === "" ? [] : [{ end: chars.length, color: ink }],
      paras: lines.map(() => ({ align: alignment })),
      style: textStyle,
      resize: "fixed",
      alignV,
    }),
  )
  const fit = emit.fit
  if (fit === undefined) return { key, field, kind: "shape", props: { ...shared, text } }

  const fits = (candidate: Text, width: number | null, linesLimit: number) =>
    naming(`${field}.fit`, () => {
      charge(96 + (width === null ? 2 : 6) * chars.length + 8 * (lines.length - 1))
      const result = measure(candidate, theme, width)
      return (
        numeric(result.w) <= position.w &&
        numeric(result.h) <= position.h &&
        result.lines.length <= linesLimit &&
        (width === null || result.lines.every((line) => line.ink <= position.w + 1e-6))
      )
    })
  if (fits(text, null, fit === "omit" ? Infinity : 2)) return { key, field, kind: "shape", props: { ...shared, text } }
  if (fit === "omit") return undefined

  const small = readField("fit.smaller", fit.smaller, smallerSize)
  const reduced =
    small < theme.textStyles[text.style].size
      ? { ...text, spans: text.spans.map((span) => ({ ...span, size: small })) }
      : text
  if (fits(reduced, position.w, 2)) return { key, field, kind: "shape", props: { ...shared, text: reduced } }
  return { kind: "text-fit", key, field: `${field}.chars` }
}

const rootKey = ["root"] as const
const keyString = (key: PartKey): string => JSON.stringify(key)

export function treeOf(
  name: string,
  frame: ReturnType<typeof readFrame>,
  parts: readonly PreparedPart[],
  findings: readonly ComponentFinding[],
  charge: Charge,
): ComponentTree {
  const seen = new Map<string, { readonly id: NodeId; readonly part: PreparedPart }>()
  for (const [index, part] of parts.entries()) {
    const key = keyString(part.key)
    naming(`${part.field}.key`, () => {
      charge(key.length)
      if (key === keyString(rootKey)) reject("shape", 'The key ["root"] is reserved.')
      if (seen.has(key)) reject("shape", `Duplicate emitted key ${key}.`)
    })
    seen.set(key, { id: nodeId(`component:${index + 2}`), part })
  }

  const resolve = (end: PartEnd): { readonly end: End; readonly x: number; readonly y: number } => {
    if (!("key" in end)) {
      const point = { x: Math.round(end.x), y: Math.round(end.y) }
      return { ...point, end: point }
    }
    const target = seen.get(keyString(end.key))
    if (target === undefined || target.part.kind !== "shape")
      return reject("shape", `The site must name an emitted shape. No shape has key ${keyString(end.key)}.`)
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
    const a = naming(`${part.field}.start`, () => resolve(start))
    const b = naming(`${part.field}.end`, () => resolve(end))
    children.push({
      ...node,
      props: {
        name: part.key.join(" / "),
        box: naming(part.field, () =>
          box(
            coordinate(Math.min(a.x, b.x)),
            coordinate(Math.min(a.y, b.y)),
            size(Math.abs(a.x - b.x)),
            size(Math.abs(a.y - b.y)),
          ),
        ),
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
    findings,
  }
}
