import type { AgentChart, AgentColor, AgentFill, AgentLook } from "./agent-change.js"
import type { Chart } from "./chart.js"
import type { Values } from "./agent-draft.js"
import type { Align9, Layout } from "./layout.js"
import { textFromMarkdown } from "./markdown.js"
import type { Color, ColorVar, Hex, Paint, Sides, StrokeStyle } from "./paint.js"
import type { Box } from "./doom-walk.js"
import { zeroBox } from "./doom-walk.js"
import type { Text, TextStyleName } from "./text.js"

export type Now = {
  readonly stroke?: StrokeStyle | undefined
  readonly box?: Box | undefined
  readonly layout?: Layout | undefined
  readonly text?: Text | undefined
}

const defaultWeight = 2

export const colorOf = (color: AgentColor): Color =>
  color.startsWith("#") ? (color as Hex) : { var: color as ColorVar }
export const solid = (color: AgentColor): Paint => ({ kind: "solid", color: colorOf(color) })

export const paintsOf = (fill: AgentFill): readonly Paint[] =>
  fill === "none" ? [] : typeof fill === "object" ? [{ kind: "image", asset: fill.image, fit: "fill" }] : [solid(fill)]

export const chartOf = (chart: AgentChart): Chart => ({
  kind: chart.kind,
  categories: chart.categories,
  series: chart.series.map((series) => ({
    name: series.name,
    values: series.values,
    ...(series.color === undefined ? {} : { color: colorOf(series.color) }),
  })),
  ...(chart.labels === undefined ? {} : { labels: chart.labels }),
})

export const iconName = (icon: string): string => (icon.includes("/") ? icon : `lucide/${icon}`)

export const sidesOf = (all: number): Sides => ({ t: all, r: all, b: all, l: all })

export function surfaceOf(look: AgentLook, now: Now = {}, align: StrokeStyle["align"] = "inside"): Values {
  const hasColor = look.stroke !== undefined && look.stroke !== "none"
  const weight = look.strokeWidth ?? (hasColor && now.stroke === undefined ? defaultWeight : undefined)
  return {
    ...(look.fill === undefined ? {} : { fills: paintsOf(look.fill) }),
    ...(look.stroke === undefined ? {} : { strokes: look.stroke === "none" ? [] : [solid(look.stroke)] }),
    ...(weight === undefined ? {} : { stroke: { ...(now.stroke ?? { align, dash: "solid" as const }), weight } }),
    ...(look.radius === undefined ? {} : { radius: look.radius }),
    ...(look.effect === undefined ? {} : { effects: look.effect === "none" ? [] : look.effect }),
    ...(look.opacity === undefined ? {} : { opacity: look.opacity }),
    ...(look.name === undefined ? {} : { name: look.name }),
    ...(look.hidden === undefined ? {} : { hidden: look.hidden }),
    ...(look.box === undefined ? {} : { box: { ...(now.box ?? zeroBox), ...look.box } }),
  }
}

const horizontal = { left: "left", center: "center", right: "right" } as const

export function alignWith(previous: Align9 | undefined, align: AgentLook["align"] & string): Align9 {
  return `${previous?.split("-")[0] ?? "top"}-${horizontal[align]}` as Align9
}

export function layoutOf(look: AgentLook, now: Layout | undefined, fallbackGap: number): Layout | undefined {
  if (look.layout === undefined && look.gap === undefined && look.padding === undefined && look.align === undefined)
    return undefined
  if (look.layout === "none") return { mode: "none" }
  const mode = look.layout ?? (now?.mode === "row" || now?.mode === "column" || now?.mode === "grid" ? now.mode : null)
  if (mode === null) return undefined
  const carried = now?.mode === mode ? now : undefined
  if (mode === "grid") {
    if (carried?.mode !== "grid") return undefined
    return {
      ...carried,
      gap: look.gap ?? carried.gap,
      padding: look.padding === undefined ? carried.padding : sidesOf(look.padding),
    }
  }
  const flow = carried?.mode === "row" || carried?.mode === "column" ? carried : undefined
  const align = look.align === undefined ? (flow?.align ?? "top-left") : alignWith(flow?.align, look.align)
  return {
    mode,
    ...(flow?.wrap === undefined ? {} : { wrap: flow.wrap }),
    gap: look.gap ?? flow?.gap ?? fallbackGap,
    padding: look.padding === undefined ? (flow?.padding ?? sidesOf(0)) : sidesOf(look.padding),
    align,
  }
}

const sameColor = (a: Color | undefined, b: Color | undefined) => JSON.stringify(a) === JSON.stringify(b)

export function uniformColor(text: Text): Color | undefined {
  const first = text.spans[0]?.color
  return first !== undefined && text.spans.every((span) => sameColor(span.color, first)) ? first : undefined
}

export function uniformAlign(text: Text): Text["paras"][number]["align"] {
  const first = text.paras[0]?.align
  return text.paras.every((para) => para.align === first) ? first : undefined
}

function coloured(text: Text, color: Color): Text {
  if (text.chars === "") return text
  const spans = text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
  return { ...text, spans: spans.map((span) => ({ ...span, color })) }
}

export function textOfLook(look: AgentLook, now: Text | undefined, fallback: TextStyleName): Text | undefined {
  if (look.text === undefined && look.textStyle === undefined && look.align === undefined && look.color === undefined)
    return undefined
  const style = look.textStyle ?? now?.style ?? fallback
  const words = look.text
  const replacing = words !== undefined && now !== undefined
  let text: Text
  if (words === undefined) text = { ...(now ?? textFromMarkdown("", style)), style }
  else {
    const made = textFromMarkdown(words, style)
    text =
      now === undefined
        ? made
        : {
            ...made,
            resize: now.resize,
            alignV: now.alignV,
            ...(now.padding === undefined ? {} : { padding: now.padding }),
          }
  }
  const align = look.align ?? (replacing ? uniformAlign(now) : undefined)
  if (align !== undefined) text = { ...text, paras: text.paras.map((para) => ({ ...para, align })) }
  const color = look.color !== undefined ? colorOf(look.color) : replacing ? uniformColor(now) : undefined
  return color === undefined ? text : coloured(text, color)
}
