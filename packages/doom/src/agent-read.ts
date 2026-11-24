import type { AgentChart, AgentColor } from "./agent-change.js"
import { uniformAlign, uniformColor } from "./agent-look.js"
import type { Arrow, End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import type { Layout } from "./layout.js"
import type { Color, ImagePaint, Paint, Sides } from "./paint.js"
import { cropSides } from "./picture-crop.js"
import type { Node, Doom } from "./doom.js"
import { type Box, childrenOf, isLaidOut, isLive, parentOf, propOf, slidesOf } from "./doom-walk.js"
import { textToMarkdown } from "./markdown.js"
import { paintedFace } from "./painted-face.js"
import type { Para, Span, Text } from "./text.js"

const quoted = (words: string) => JSON.stringify(words)
const num = (value: number) => String(Number(value.toFixed(1)))
const iconWords = (name: string) => (name.startsWith("lucide/") ? name.slice("lucide/".length) : name)

const tintWords = (tint: number) => `${tint > 0 ? "+" : "-"}${String(Math.round(Math.abs(tint) * 100))}`
const colorWords = (color: Color): AgentColor =>
  typeof color === "string"
    ? color
    : color.tint === undefined || color.tint === 0
      ? color.var
      : (`${color.var}${tintWords(color.tint)}` as AgentColor)

function fitWords(paint: ImagePaint): string {
  if (paint.fit === "fill") return ""
  if (paint.fit !== "crop" || paint.crop === undefined) return `/${paint.fit}`
  const { left, top, right, bottom } = cropSides(paint.crop)
  return `/crop(${[left, top, right, bottom].map(num).join(",")})`
}

function oneWords(paint: Paint): string {
  if (paint.kind === "solid") return colorWords(paint.color)
  if (paint.kind === "image") return `image:${paint.asset}${fitWords(paint)}`
  const stops = paint.stops.map((stop) => colorWords(stop.color)).join(">")
  return paint.shape === "radial" ? `radial(${stops})` : `gradient(${stops}@${num(paint.angle)})`
}

function paintWords(paints: readonly Paint[]): string {
  return paints
    .filter((paint) => paint.visible !== false)
    .map(oneWords)
    .join(",")
}

const sidesWords = (sides: Sides) =>
  sides.t === sides.r && sides.r === sides.b && sides.b === sides.l
    ? num(sides.t)
    : `${num(sides.t)},${num(sides.r)},${num(sides.b)},${num(sides.l)}`

function layoutWords(layout: Layout): readonly string[] {
  if (layout.mode === "none") return []
  if (layout.mode === "grid")
    return [`layout=grid`, `cols=${layout.columns.length}`, `rows=${layout.rows.length}`, `gap=${num(layout.gap)}`]
  const padding = sidesWords(layout.padding)
  return [`layout=${layout.mode}`, `gap=${num(layout.gap)}`, ...(padding === "0" ? [] : [`padding=${padding}`])]
}

function chartWords(node: Node): string | undefined {
  const chart = propOf(node, "chart")
  if (chart === undefined) return undefined
  const words: AgentChart = {
    kind: chart.kind,
    categories: chart.categories,
    series: chart.series.map((series) => ({
      name: series.name,
      values: series.values,
      ...(series.color === undefined ? {} : { color: colorWords(series.color) }),
    })),
    ...(chart.labels === undefined ? {} : { labels: chart.labels }),
    ...(chart.unit === undefined ? {} : { unit: chart.unit }),
  }
  return `chart=${JSON.stringify(words)}`
}

export function kindOf(node: Node): string {
  if (node.type === "slide" || node.type === "slideRow") return node.type
  if (node.type === "frame") return propOf(node, "chart") === undefined ? "frame" : "chart"
  const kind = propOf(node, "geometry")?.kind
  if (kind === "line" || kind === "icon") return kind
  const fills = propOf(node, "fills") ?? []
  if (fills.some((paint) => paint.kind === "image")) return "picture"
  const painted = fills.length > 0 || (propOf(node, "strokes") ?? []).length > 0
  return propOf(node, "text") !== undefined && !painted ? "text" : "shape"
}

function placeWords(doom: Doom, node: Node, boxes: ReadonlyMap<NodeId, Box> | undefined): string | undefined {
  const solved = boxes?.get(node.id)
  const box = solved ?? propOf(node, "box")
  if (box === undefined) return undefined
  const above = parentOf(node)
  const parent = above == null ? undefined : doom.nodes.get(above.id)
  const free = solved !== undefined || parent === undefined || !isLaidOut(parent)
  const size = `${num(box.w)}x${num(box.h)}`
  const turned = box.rotation === 0 ? "" : ` r=${num(box.rotation)}`
  const flipped = box.flipH || box.flipV ? ` flip=${box.flipH ? "h" : ""}${box.flipV ? "v" : ""}` : ""
  return `${free ? `@${num(box.x)},${num(box.y)} ` : ""}${size}${turned}${flipped}`
}

function looksOf(node: Node): readonly string[] {
  const out: string[] = []
  const name = propOf(node, "name")
  const fills = propOf(node, "fills")
  const strokes = propOf(node, "strokes")
  const stroke = propOf(node, "stroke")
  const radius = propOf(node, "radius")
  const effects = propOf(node, "effects")
  const opacity = propOf(node, "opacity")
  const text = propOf(node, "text")
  const geometry = propOf(node, "geometry")
  if (name !== undefined) out.push(`name=${quoted(name)}`)
  if (fills !== undefined && fills.length > 0) out.push(`fill=${paintWords(fills)}`)
  if (strokes !== undefined && strokes.length > 0) out.push(`stroke=${paintWords(strokes)}`)
  if (stroke !== undefined && strokes !== undefined && strokes.length > 0) out.push(`strokeWidth=${num(stroke.weight)}`)
  if (stroke !== undefined && stroke.dash !== "solid" && strokes !== undefined && strokes.length > 0)
    out.push(`dash=${stroke.dash}`)
  if (radius !== undefined && radius !== 0)
    out.push(`radius=${typeof radius === "number" ? num(radius) : radius.map(num).join(",")}`)
  if (typeof effects === "string") out.push(`effect=${effects}`)
  else if (effects !== undefined && effects.length > 0) {
    const blur = effects.find((effect) => effect.kind === "layerBlur")
    if (effects.some((effect) => effect.kind !== "layerBlur" && effect.kind !== "innerShadow"))
      out.push("effect=custom")
    if (blur !== undefined && "radius" in blur) out.push(`blur=${num(blur.radius)}`)
    for (const shadow of effects) {
      if (shadow.kind !== "innerShadow") continue
      const opacity = shadow.opacity === undefined ? "" : `@${num(shadow.opacity)}`
      out.push(
        `innerShadow=${colorWords(shadow.color)},${num(shadow.x)},${num(shadow.y)},${num(shadow.blur)},${num(shadow.spread)}${opacity}`,
      )
    }
  }
  if (opacity !== undefined && opacity !== 1) out.push(`opacity=${num(opacity)}`)
  if (propOf(node, "hidden") === true) out.push("hidden")
  if (propOf(node, "locked") === true) out.push("locked")
  const layout = propOf(node, "layout")
  if (layout !== undefined && node.type === "frame") out.push(...layoutWords(layout))
  if (text !== undefined) {
    out.push(`style=${text.style}`, `resize=${text.resize}`)
    const align = uniformAlign(text)
    if (align !== undefined && align !== "left") out.push(`align=${align}`)
    const color = uniformColor(text)
    if (color !== undefined && colorWords(color) !== "text") out.push(`color=${colorWords(color)}`)
    out.push(...overrideWords(text))
    if (text.alignV !== "top") out.push(`alignV=${text.alignV}`)
    const before = uniformPara(text, "spaceBefore")
    const after = uniformPara(text, "spaceAfter")
    if (before !== undefined && before !== 0) out.push(`spaceBefore=${num(before)}`)
    if (after !== undefined && after !== 0) out.push(`spaceAfter=${num(after)}`)
  }
  if (geometry?.kind === "ellipse") out.push("shape=ellipse")
  if (geometry?.kind === "preset") out.push(`shape=${geometry.name}`)
  if (geometry?.kind === "icon") out.push(`icon=${iconWords(geometry.name)}`)
  if (geometry?.kind === "line") out.push(...lineWords(geometry))
  const chart = chartWords(node)
  if (chart !== undefined) out.push(chart)
  if (text !== undefined) out.push(`text=${quoted(textToMarkdown(text))}`)
  return out
}

const sideWords = { t: "top", r: "right", b: "bottom", l: "left", c: "center" } as const

function shownArrow(name: string, arrow: Arrow): readonly string[] {
  if (arrow === "none") return []
  if (name === "arrow" && arrow === "arrow") return ["arrow"]
  return [`${name}=${arrow}`]
}

function lineWords(line: Extract<Geometry, { kind: "line" }>): readonly string[] {
  const end = (name: string, at: End) => ("node" in at ? [`${name}=${at.node}:${sideWords[at.site]}`] : [])
  return [
    ...end("from", line.start),
    ...end("to", line.end),
    ...(line.route === "straight" ? [] : [`route=${line.route}`]),
    ...shownArrow("startArrow", line.arrows[0]),
    ...shownArrow("arrow", line.arrows[1]),
  ]
}

function uniformPara<K extends keyof Para>(text: Text, key: K): Para[K] | undefined {
  const first = text.paras[0]?.[key]
  return text.paras.every((para) => para[key] === first) ? first : undefined
}

function faceWords(font: string | undefined, bold: boolean | undefined): readonly string[] {
  if (font === undefined) return bold === undefined ? [] : [`weight=${bold ? "Bold" : "Regular"}`]
  const painted = paintedFace(font, 400, bold)
  const resting = bold === undefined && painted.family === font
  return [`font=${quoted(painted.family)}`, ...(resting ? [] : [`weight=${painted.name}`])]
}

function overrideWords(text: Text): readonly string[] {
  const same = <K extends keyof Span>(key: K): Span[K] | undefined => {
    const first = text.spans[0]?.[key]
    return first !== undefined && text.spans.every((span) => span[key] === first) ? first : undefined
  }
  const size = same("size")
  const font = same("font")
  const bold = same("bold")
  const tracking = same("tracking")
  const letterCase = same("case")
  const line = text.paras[0]?.lineHeight
  return [
    ...(size === undefined ? [] : [`size=${num(size)}`]),
    ...faceWords(font, bold),
    ...(tracking === undefined ? [] : [`letterSpacing=${num(tracking)}`]),
    ...(letterCase === undefined ? [] : [`case=${letterCase}`]),
    ...(same("underline") === true ? ["underline"] : []),
    ...(same("strike") === true ? ["strike"] : []),
    ...(line !== undefined && text.paras.every((para) => para.lineHeight === line) ? [`lineHeight=${num(line)}`] : []),
  ]
}

function lineOf(doom: Doom, node: Node, depth: number, boxes: ReadonlyMap<NodeId, Box> | undefined): string {
  const role = propOf(node, "role")
  const kind = `${kindOf(node)}${role === undefined ? "" : `:${role}`}`
  const place = placeWords(doom, node, boxes)
  return `${"  ".repeat(depth)}${[node.id, kind, ...(place === undefined ? [] : [place]), ...looksOf(node)].join(" ")}`
}

function walk(doom: Doom, node: Node, depth: number, boxes: ReadonlyMap<NodeId, Box> | undefined, out: string[]): void {
  out.push(lineOf(doom, node, depth, boxes))
  for (const child of childrenOf(doom, node.id)) walk(doom, child, depth + 1, boxes, out)
}

function slideLine(node: Node): string {
  const name = propOf(node, "name")
  const fills = propOf(node, "fills")
  const notes = propOf(node, "notes")
  const transition = propOf(node, "transition")
  return [
    "slide",
    node.id,
    ...(name === undefined ? [] : [quoted(name)]),
    ...(propOf(node, "hidden") === true ? ["hidden"] : []),
    ...(propOf(node, "skipped") === true ? ["skipped"] : []),
    ...(transition === undefined ? [] : [`transition=${transition.kind}/${String(transition.ms)}`]),
    ...(fills !== undefined && fills.length > 0 ? [`fill=${paintWords(fills)}`] : []),
    ...(notes === undefined || notes.chars === "" ? [] : [`notes=${quoted(notes.chars)}`]),
  ].join(" ")
}

export function readForAgent(doom: Doom, slides: readonly NodeId[] | "all", boxes?: ReadonlyMap<NodeId, Box>): string {
  const out: string[] = []
  const wanted = slides === "all" ? slidesOf(doom).map((slide) => slide.id) : slides
  for (const id of wanted) {
    const slide = doom.nodes.get(id)
    if (!isLive(slide) || slide.type !== "slide") {
      out.push(`${id} missing`)
      continue
    }
    out.push(slideLine(slide))
    for (const child of childrenOf(doom, slide.id)) walk(doom, child, 1, boxes, out)
  }
  return out.join("\n")
}
