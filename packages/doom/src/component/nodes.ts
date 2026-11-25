import { type End, readChannel, type Channel } from "../geometry.js"
import { siteSpot } from "../preset-geometry.js"
import { nodeId, type NodeId } from "../ids.js"
import { props, type Props } from "../props.js"
import { isRefusal } from "../refusal.js"
import { type Text, type TextStyleName, textStyleNames } from "../text.js"
import { textContent } from "./text-content.js"
import { keyOf, keyString, type PartKey } from "./instance.js"
import { type Reader, finite, list, literal, naming, object, reject } from "../read-kit.js"
import { type FittingContext, fitGroups, fitOne, textSize } from "./fit-text.js"
import type { ComponentFinding, TextFitFinding } from "./findings.js"
import type { Expr } from "./expression.js"
import type { Emission } from "./spec.js"
import { color, type Value } from "./values.js"

type ShapeProps = Pick<Props, "name" | "box" | "geometry"> &
  Partial<Pick<Props, "fills" | "strokes" | "stroke" | "radius" | "text">>
export type ComponentNode = {
  readonly id: NodeId
  readonly key: PartKey
  readonly type: "shape"
  readonly props: ShapeProps
  readonly generatedStyle?: TextStyleName
}
export type ComponentTree = {
  readonly id: NodeId
  readonly key: readonly ["root"]
  readonly type: "frame"
  readonly props: Pick<Props, "name" | "box"> & Partial<Pick<Props, "layout">>
  readonly children: readonly ComponentNode[]
  readonly findings: readonly ComponentFinding[]
}

const prop = <K extends keyof typeof props>(key: K, raw: unknown): Props[K] => {
  const value = props[key].read(raw)
  if (!isRefusal(value)) return value
  const refuse = () => reject(value.refused === "limit" ? "limit" : "shape", value.form ?? `Valid ${key} properties.`)
  return value.field === undefined ? refuse() : naming(value.field, refuse)
}

export const readLayout = (raw: Value): Props["layout"] => prop("layout", raw)

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

const readPoint = object({ x: coordinate, y: coordinate })
const readSite = object({ key: keyOf, site: literal(["t", "r", "b", "l", "c"]) }, { along: finite(0, 1) })

type PartEnd = ReturnType<typeof readPoint> | ReturnType<typeof readSite>
const endpoint = (raw: Value): PartEnd =>
  raw !== null && typeof raw === "object" && Object.hasOwn(raw, "key") ? readSite(raw) : readPoint(raw)

type Line = {
  readonly start: PartEnd
  readonly end: PartEnd
  readonly route: Extract<Props["geometry"], { kind: "line" }>["route"]
  readonly channels?: readonly Channel[]
  readonly arrow: Extract<Props["geometry"], { kind: "line" }>["arrows"][1]
  readonly strokes: Props["strokes"]
  readonly stroke: Props["stroke"]
}

type PlacedPart = { readonly key: PartKey; readonly field: string } & (
  | { readonly kind: "shape"; readonly props: ShapeProps; readonly generatedStyle?: TextStyleName }
  | { readonly kind: "line"; readonly line: Line }
)

export type TextPart = {
  readonly kind: "shape"
  readonly key: PartKey
  readonly field: string
  readonly props: ShapeProps & { readonly text: Text }
  readonly generatedStyle?: TextStyleName
}
export type GroupedText = {
  readonly kind: "grouped-text"
  readonly part: TextPart
  readonly group: string
  readonly smaller: number
  readonly thin: number | undefined
  readonly laneWidth: number
}
export type Kept = { readonly kind: "kept"; readonly part: TextPart; readonly finding: TextFitFinding }
export type PreparedPart = PlacedPart | GroupedText | Kept | TextFitFinding

const align = literal(["left", "center", "right", "justify"])
const vertical = literal(["top", "center", "bottom"])
const route = literal(["straight", "elbow", "curve"])
const arrow = literal(["none", "arrow", "triangle", "circle"])
const sides = (value: Value): Value => (typeof value === "number" ? { t: value, r: value, b: value, l: value } : value)
const dash = literal(["solid", "dash", "dot"])
const smallerSize = finite(1, 2_000)

type ComponentStyle = ((key: PartKey) => TextStyleName | undefined) | undefined

export function preparePart(
  emit: Emission,
  field: string,
  context: FittingContext & {
    readonly read: (expr: Expr, field: string, key?: PartKey) => Value
    readonly styleFor: ComponentStyle
  },
): PreparedPart {
  const { read, charge } = context
  const key = naming(`${field}.key`, () => keyOf(read(emit.key, `${field}.key`)))
  const readField = <T>(name: string, expr: Expr, parse: (value: Value) => T): T => {
    const path = `${field}.${name}`
    return naming(path, () => parse(read(expr, path, key)))
  }
  if (emit.kind === "line") {
    return {
      key,
      field,
      kind: "line",
      line: {
        start: readField("start", emit.start, endpoint),
        end: readField("end", emit.end, endpoint),
        route: readField("route", emit.route, route),
        ...(emit.channels === undefined
          ? {}
          : { channels: readField("channels", emit.channels, list(readChannel, 8)) }),
        arrow: readField("arrow", emit.arrow, arrow),
        strokes: [{ kind: "solid", color: readField("color", emit.color, color) }],
        stroke: readField("width", emit.width, (weight) =>
          prop("stroke", {
            weight,
            align: "center",
            dash: emit.dash === undefined ? "solid" : readField("dash", emit.dash, dash),
          }),
        ),
      },
    }
  }
  type Outline = { readonly color: Expr; readonly width: Expr }
  const outline = (stroke: Outline | undefined, align: "inside" | "center") =>
    stroke === undefined
      ? {}
      : {
          strokes: [{ kind: "solid" as const, color: readField("stroke.color", stroke.color, color) }],
          stroke: readField("stroke.width", stroke.width, (weight) => prop("stroke", { weight, align, dash: "solid" })),
        }
  const surface = (emit: { readonly stroke?: Outline; readonly radius?: Expr }) => ({
    ...outline(emit.stroke, "inside"),
    ...(emit.radius === undefined
      ? {}
      : { radius: readField("radius", emit.radius, (value) => prop("radius", value)) }),
  })
  const filled = (fill: Expr | undefined) =>
    fill === undefined ? {} : { fills: [{ kind: "solid" as const, color: readField("fill", fill, color) }] }
  const x = readField("x", emit.x, coordinate)
  const y = readField("y", emit.y, coordinate)
  const w = readField("w", emit.w, size)
  const h = readField("h", emit.h, size)
  const position = box(x, y, w, h)
  const shared = { name: key.join(" / "), box: position, geometry: { kind: "rect" } } as const
  if (emit.kind === "rect")
    return {
      key,
      field,
      kind: "shape",
      props: { ...shared, ...filled(emit.fill), ...surface(emit) },
    }

  if (emit.kind === "path") {
    const geometry = readField("d", emit.d, (d) => {
      if (typeof d === "string") charge(d.length)
      return prop("geometry", { kind: "path", d, ...(emit.fillStroke ? { fillStroke: true } : {}) })
    })
    return {
      key,
      field,
      kind: "shape",
      props: { ...shared, geometry, ...filled(emit.fill), ...outline(emit.stroke, "center") },
    }
  }

  const alignment = readField("align", emit.align, align)
  const ink = readField("color", emit.color, color)
  const textStyle = readField("style", emit.style, literal(textStyleNames))
  const explicitSize = emit.size === undefined ? undefined : readField("size", emit.size, textSize)
  const alignV = readField("alignV", emit.alignV, vertical)
  const fit = emit.fit
  const content = readField("chars", emit.chars, (raw) =>
    textContent(raw, ink, alignment, explicitSize ?? context.theme.textStyles[textStyle].size, charge),
  )
  const generated = naming(field, () =>
    prop("text", {
      ...content,
      ...(explicitSize === undefined
        ? {}
        : {
            spans: content.spans.map((span) => ({ ...span, size: span.size ?? explicitSize })),
            wrap: "none",
          }),
      style: textStyle,
      resize: "fixed",
      alignV,
      ...(fit === undefined ? {} : { wrap: "words" }),
      ...(emit.overflow === undefined ? {} : { overflow: emit.overflow }),
      ...(emit.padding === undefined ? {} : { padding: readField("padding", emit.padding, sides) }),
    }),
  )
  const style = context.styleFor?.(key)
  const text = style === undefined ? generated : { ...generated, style }
  const part: TextPart = {
    key,
    field,
    kind: "shape",
    props: { ...shared, ...filled(emit.fill), ...surface(emit), text },
    ...(style === undefined ? {} : { generatedStyle: generated.style }),
  }
  if (fit === undefined) return part
  if (fit === "omit") return fitOne(part, undefined, context)
  const smaller = Math.min(
    readField("fit.smaller", fit.smaller, smallerSize),
    context.theme.textStyles[text.style].size,
  )
  if (fit.group === undefined || style !== undefined) return fitOne(part, smaller, context)
  const laneWidth = fit.thin === undefined ? position.w : w
  const inset = Math.min((fit.thin ?? 0) / 2, laneWidth / 2)
  const label =
    fit.thin === undefined
      ? part
      : {
          ...part,
          props: { ...part.props, box: { ...position, x: x + inset, w: laneWidth - 2 * inset } },
        }
  return { kind: "grouped-text", part: label, group: fit.group, smaller, thin: fit.thin, laneWidth }
}

const rootKey = ["root"] as const

export function treeOf(
  name: string,
  frame: ReturnType<typeof readFrame>,
  parts: readonly PreparedPart[],
  context: FittingContext,
  findings: ComponentFinding[],
  layout?: Props["layout"],
): ComponentTree {
  const seen = new Map<string, { readonly id: NodeId; readonly part: PlacedPart }>()
  for (const fitted of fitGroups(parts, context, frame.w)) {
    if (fitted.kind === "text-fit") {
      findings.push(fitted)
      continue
    }
    if (fitted.kind === "kept") findings.push(fitted.finding)
    const part = fitted.kind === "kept" ? fitted.part : fitted
    const index = seen.size
    if (index >= 499) naming(part.field, () => reject("limit", "An expansion may emit at most 499 parts."))
    const key = keyString(part.key)
    naming(`${part.field}.key`, () => {
      context.charge(key.length)
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
    const { key: _key, ...attachment } = end
    const spot = siteSpot(geometry, box.w, box.h, end.site, end.along)
    return { x: box.x + spot.x, y: box.y + spot.y, end: { node: target.id, ...attachment } }
  }

  const children: ComponentNode[] = []
  for (const { id, part } of seen.values()) {
    const node = { type: "shape", id, key: part.key } as const
    if (part.kind === "shape") {
      children.push({
        ...node,
        props: part.props,
        ...(part.generatedStyle === undefined ? {} : { generatedStyle: part.generatedStyle }),
      })
      continue
    }
    const { start, end, route, arrow, strokes, stroke, channels } = part.line
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
        geometry: {
          kind: "line",
          start: a.end,
          end: b.end,
          route,
          arrows: ["none", arrow],
          ...(channels === undefined || channels.length === 0 ? {} : { channels }),
        },
        strokes,
        stroke,
      },
    })
  }
  return {
    id: nodeId("component:1"),
    type: "frame",
    key: rootKey,
    props: { name, box: box(frame.x, frame.y, frame.w, frame.h), ...(layout === undefined ? {} : { layout }) },
    children,
    findings,
  }
}
