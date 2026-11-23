import type { AgentChart, AgentColor, AgentFill, AgentLook } from "./agent-change.js"
import type { Chart } from "./chart.js"
import type { Values } from "./agent-draft.js"
import type { Align9, Layout } from "./layout.js"
import { textFromMarkdown } from "./markdown.js"
import type { Color, ColorVar, Hex, Paint, Sides, StrokeStyle } from "./paint.js"
import type { Box } from "./doom-walk.js"
import { zeroBox } from "./doom-walk.js"
import type { Span, Text, TextStyleName } from "./text.js"
import { type TextPatch, lookWrite, paraWrite, styleWrite } from "./text-writes.js"

export type Now = {
  readonly fills?: readonly Paint[] | undefined
  readonly stroke?: StrokeStyle | undefined
  readonly box?: Box | undefined
  readonly layout?: Layout | undefined
  readonly text?: Text | undefined
}

const defaultWeight = 2

export function colorOf(color: AgentColor): Color {
  if (color.startsWith("#")) return color as Hex
  const [, name, step] = /^([a-z0-9]+)([+-]\d+)?$/.exec(color) ?? []
  const tint = step === undefined ? 0 : Number(step) / 100
  return tint === 0 ? { var: name as ColorVar } : { var: name as ColorVar, tint }
}
export const solid = (color: AgentColor): Paint => ({ kind: "solid", color: colorOf(color) })

export function paintsOf(fill: AgentFill): readonly Paint[] {
  if (fill === "none") return []
  if (typeof fill !== "object") return [solid(fill)]
  if ("image" in fill) return [{ kind: "image", asset: fill.image, fit: "fill" }]
  const last = fill.gradient.length - 1
  const shape = fill.radial === true ? ("radial" as const) : ("linear" as const)
  const stops = fill.gradient.map((color, at) => ({ at: at / last, color: colorOf(color) }))
  return [{ kind: "gradient", shape, angle: fill.angle ?? 0, stops }]
}

const fitted = (paints: readonly Paint[], fit: NonNullable<AgentLook["fit"]>): readonly Paint[] =>
  paints.map((paint) => (paint.kind === "image" ? { ...paint, fit } : paint))

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
  const drawn = (look.stroke !== undefined && look.stroke !== "none") || look.dash !== undefined
  const weight =
    look.strokeWidth ??
    (drawn && now.stroke === undefined ? defaultWeight : look.dash === undefined ? undefined : now.stroke?.weight)
  const fills = look.fill === undefined ? now.fills : paintsOf(look.fill)
  const painted = look.fit === undefined || fills === undefined ? fills : fitted(fills, look.fit)
  const dash = look.dash === undefined ? {} : { dash: look.dash }
  return {
    ...(look.fill === undefined && look.fit === undefined ? {} : { fills: painted ?? [] }),
    ...(look.stroke === undefined ? {} : { strokes: look.stroke === "none" ? [] : [solid(look.stroke)] }),
    ...(weight === undefined
      ? {}
      : { stroke: { ...(now.stroke ?? { align, dash: "solid" as const }), weight, ...dash } }),
    ...(look.radius === undefined ? {} : { radius: look.radius }),
    ...(look.effect === undefined ? {} : { effects: look.effect === "none" ? [] : look.effect }),
    ...(look.opacity === undefined ? {} : { opacity: look.opacity }),
    ...(look.name === undefined ? {} : { name: look.name }),
    ...(look.hidden === undefined ? {} : { hidden: look.hidden }),
    ...(look.box === undefined && look.rotation === undefined && look.flip === undefined
      ? {}
      : {
          box: {
            ...(now.box ?? zeroBox),
            ...look.box,
            ...(look.rotation === undefined ? {} : { rotation: look.rotation }),
            ...(look.flip === undefined ? {} : { flipH: look.flip.includes("h"), flipV: look.flip.includes("v") }),
          },
        }),
  }
}

const horizontal = { left: "left", center: "center", right: "right" } as const

export function alignWith(previous: Align9 | undefined, align: keyof typeof horizontal): Align9 {
  return `${previous?.split("-")[0] ?? "top"}-${horizontal[align]}` as Align9
}

export function layoutOf(look: AgentLook, now: Layout | undefined, fallbackGap: number): Layout | undefined {
  if (look.layout === undefined && look.gap === undefined && look.padding === undefined && look.align === undefined)
    return undefined
  if (look.layout === "none") return { mode: "none" }
  const mode = look.layout ?? (now?.mode === "row" || now?.mode === "column" || now?.mode === "grid" ? now.mode : null)
  if (mode === null || look.align === "justify") return undefined
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

const textKeys = [
  "text",
  "textStyle",
  "align",
  "color",
  "size",
  "font",
  "lineHeight",
  "letterSpacing",
  "case",
  "underline",
  "strike",
] as const

function same<K extends keyof Span>(text: Text, key: K): Span[K] | undefined {
  const first = text.spans[0]?.[key]
  return first !== undefined && text.spans.every((span) => span[key] === first) ? first : undefined
}

function keptLook(now: Text): TextPatch {
  const kept = { size: same(now, "size"), font: same(now, "font"), tracking: same(now, "tracking") }
  const marks = { case: same(now, "case"), underline: same(now, "underline"), strike: same(now, "strike") }
  return Object.fromEntries(Object.entries({ ...kept, ...marks }).filter(([, value]) => value !== undefined))
}

function keptLineHeight(now: Text): number | undefined {
  const first = now.paras[0]?.lineHeight
  return first !== undefined && now.paras.every((para) => para.lineHeight === first) ? first : undefined
}

const askedLook = (look: AgentLook): TextPatch =>
  Object.fromEntries(
    Object.entries({
      size: look.size,
      font: look.font,
      tracking: look.letterSpacing,
      case: look.case,
      underline: look.underline,
      strike: look.strike,
    }).filter(([, value]) => value !== undefined),
  )

export function textOfLook(look: AgentLook, now: Text | undefined, fallback: TextStyleName): Text | undefined {
  if (textKeys.every((key) => look[key] === undefined)) return undefined
  const style = look.textStyle ?? now?.style ?? fallback
  const words = look.text
  const replacing = words !== undefined && now !== undefined
  const keeping = replacing && look.textStyle === undefined
  let text: Text
  if (words === undefined)
    text = now === undefined ? textFromMarkdown("", style) : look.textStyle === undefined ? now : styleWrite(now, style)
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
  if (color !== undefined) text = coloured(text, color)
  const patch = { ...(keeping ? keptLook(now) : {}), ...askedLook(look) }
  if (Object.keys(patch).length > 0) text = lookWrite(text, patch)
  const lineHeight = look.lineHeight ?? (keeping ? keptLineHeight(now) : undefined)
  return lineHeight === undefined ? text : paraWrite(text, { lineHeight })
}
