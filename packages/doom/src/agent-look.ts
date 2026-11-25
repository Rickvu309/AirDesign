import type { AgentColor, AgentFill, AgentLook } from "./agent-change.js"
import type { Arrow } from "./geometry.js"
import { shapeGeometry } from "./preset-geometry.js"
import { namedColor, sameColor as samePaint } from "./color.js"
import type { Values } from "./agent-draft.js"
import type { Align9, Layout } from "./layout.js"
import { withScheme } from "./link.js"
import { textFromMarkdown } from "./markdown.js"
import { cropWindow } from "./picture-crop.js"
import {
  type Color,
  type Effect,
  type EffectStyleName,
  type Paint,
  type Sides,
  type StrokeStyle,
  effectStyleNames,
  readHex,
} from "./paint.js"
import { type Theme, defaultTheme } from "./theme.js"
import type { Box } from "./doom-walk.js"
import { zeroBox } from "./doom-walk.js"
import { familyOf, storedFace, type WeightName } from "./painted-face.js"
import type { Para, Span, Text, TextStyleName } from "./text.js"
import { type TextPatch, lookWrite, paraWrite, styleWrite } from "./text-writes.js"

export type Now = {
  readonly fills?: readonly Paint[] | undefined
  readonly stroke?: StrokeStyle | undefined
  readonly box?: Box | undefined
  readonly layout?: Layout | undefined
  readonly text?: Text | undefined
  readonly effects?: readonly Effect[] | EffectStyleName | undefined
}

const defaultWeight = 2

export function askedArrow(asked: boolean | Arrow | undefined, kept: Arrow): Arrow {
  if (asked === undefined) return kept
  if (typeof asked === "boolean") return asked ? "arrow" : "none"
  return asked
}

export function colorOf(color: AgentColor): Color {
  if (color.startsWith("#")) return readHex(color)
  const parsed = namedColor(color)
  if (parsed === undefined) throw new Error(`Invalid agent colour ${color}`)
  return parsed
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

function fitted(paints: readonly Paint[], look: AgentLook): readonly Paint[] {
  const fit = look.crop === undefined ? look.fit : "crop"
  return paints.map((paint) => {
    if (paint.kind !== "image" || fit === undefined) return paint
    const { crop, ...rest } = paint
    if (fit !== "crop") return { ...rest, fit }
    const shown = look.crop === undefined ? crop : cropWindow(look.crop)
    return { ...rest, fit, ...(shown === undefined ? {} : { crop: shown }) }
  })
}

export const iconName = (icon: string): string => (icon.includes("/") ? icon : `lucide/${icon}`)

export const sidesOf = (all: number | Sides): Sides =>
  typeof all === "number" ? { t: all, r: all, b: all, l: all } : all

export const turnOf = (look: AgentLook): Partial<Box> => ({
  ...(look.rotation === undefined ? {} : { rotation: look.rotation }),
  ...(look.flip === undefined ? {} : { flipH: look.flip.includes("h"), flipV: look.flip.includes("v") }),
})

function sameEffect(a: Effect, b: Effect): boolean {
  if (a.kind !== b.kind) return false
  if ("radius" in a || "radius" in b) return "radius" in a && "radius" in b && a.radius === b.radius
  return a.x === b.x && a.y === b.y && a.blur === b.blur && a.spread === b.spread && samePaint(a.color, b.color)
}

function styleName(held: Now["effects"], theme: Theme | undefined): EffectStyleName | undefined {
  if (theme === undefined || held === undefined) return undefined
  if (typeof held === "string") return effectStyleNames.find((name) => name === held)
  return effectStyleNames.find((name) => {
    const style = theme.effectStyles[name]
    return style.length === held.length && style.every((effect, at) => sameEffect(effect, held[at]!))
  })
}

function writtenEffects(look: AgentLook, held: Now["effects"], theme: Theme | undefined): Values["effects"] {
  if (look.effect === undefined && look.effectOpacity === undefined) return undefined
  if (look.effect === "none") return []
  if (look.effectOpacity === undefined) return look.effect
  const opacity = look.effectOpacity
  const name = look.effect ?? styleName(held, theme)
  if (name === undefined || theme === undefined) return undefined
  return theme.effectStyles[name].map((effect) => ("color" in effect ? { ...effect, opacity } : effect))
}

const listed = (
  effects: readonly Effect[] | EffectStyleName | undefined,
  theme: Theme | undefined,
): readonly Effect[] => {
  if (effects === undefined) return []
  return typeof effects === "string" ? (theme === undefined ? [] : theme.effectStyles[effects]) : effects
}

const heldEffects = (
  produced: readonly Effect[] | EffectStyleName | undefined,
  now: Now["effects"],
): readonly Effect[] | EffectStyleName | undefined => (produced !== undefined ? produced : now)

export function effectsOf(
  look: AgentLook,
  now: Now["effects"],
  theme?: Theme,
): readonly Effect[] | EffectStyleName | undefined {
  let current = writtenEffects(look, now, theme)
  if (look.blur !== undefined) {
    const base = heldEffects(current, now)
    const list = listed(base, theme)
    if (look.blur === 0 && !list.some((effect) => effect.kind === "layerBlur")) current = base === undefined ? [] : base
    else {
      const kept = list.filter((effect) => effect.kind !== "layerBlur")
      current = look.blur === 0 ? kept : [...kept, { kind: "layerBlur", radius: look.blur }]
    }
  }
  if (look.innerShadow === undefined) return current
  const base = heldEffects(current, now)
  const list = listed(base, theme)
  if (look.innerShadow === "none" && !list.some((effect) => effect.kind === "innerShadow"))
    return base === undefined ? [] : base
  const kept = list.filter((effect) => effect.kind !== "innerShadow")
  if (look.innerShadow === "none") return kept
  const shadow = look.innerShadow
  return [
    ...kept,
    {
      kind: "innerShadow",
      color: colorOf(shadow.color),
      x: shadow.x,
      y: shadow.y,
      blur: shadow.blur,
      spread: shadow.spread,
      ...(shadow.opacity === undefined ? {} : { opacity: shadow.opacity }),
    },
  ]
}

export function surfaceOf(
  look: AgentLook,
  now: Now = {},
  align: StrokeStyle["align"] = "inside",
  theme?: Theme,
): Values {
  const drawn = (look.stroke !== undefined && look.stroke !== "none") || look.dash !== undefined
  const weight =
    look.strokeWidth ??
    (drawn && now.stroke === undefined ? defaultWeight : look.dash === undefined ? undefined : now.stroke?.weight)
  const fills = look.fill === undefined ? now.fills : paintsOf(look.fill)
  const fitting = look.fit !== undefined || look.crop !== undefined
  const painted = !fitting || fills === undefined ? fills : fitted(fills, look)
  const dash = look.dash === undefined ? {} : { dash: look.dash }
  const effects = effectsOf(look, now.effects, theme)
  return {
    ...(look.fill === undefined && !fitting ? {} : { fills: painted ?? [] }),
    ...(look.stroke === undefined ? {} : { strokes: look.stroke === "none" ? [] : [solid(look.stroke)] }),
    ...(weight === undefined
      ? {}
      : { stroke: { ...(now.stroke ?? { align, dash: "solid" as const }), weight, ...dash } }),
    ...(look.shape === undefined ? {} : { geometry: shapeGeometry(look.shape) }),
    ...(look.radius === undefined ? {} : { radius: look.radius }),
    ...(effects === undefined ? {} : { effects }),
    ...(look.clip === undefined ? {} : { clip: look.clip }),
    ...(look.mask === undefined ? {} : { mask: look.mask }),
    ...(look.link === undefined || look.link === "none" ? {} : { link: withScheme(look.link) }),
    ...(look.opacity === undefined ? {} : { opacity: look.opacity }),
    ...(look.name === undefined ? {} : { name: look.name }),
    ...(look.hidden === undefined ? {} : { hidden: look.hidden }),
    ...(look.locked === undefined ? {} : { locked: look.locked }),
    ...(look.box === undefined && look.rotation === undefined && look.flip === undefined
      ? {}
      : {
          box: {
            ...(now.box ?? zeroBox),
            ...look.box,
            ...turnOf(look),
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
  "language",
  "text",
  "textStyle",
  "align",
  "color",
  "size",
  "font",
  "weight",
  "lineHeight",
  "letterSpacing",
  "case",
  "underline",
  "strike",
  "alignV",
  "spaceBefore",
  "spaceAfter",
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

function keptMarks(text: Text, now: Text, keeping: boolean): Text {
  const kept = {
    ...(keeping ? { bold: same(now, "bold"), italic: same(now, "italic") } : {}),
    figures: same(now, "figures"),
  }
  const marks = Object.entries(kept).filter(([, value]) => value !== undefined)
  if (marks.length === 0 || text.chars === "") return text
  const spans = text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
  return {
    ...text,
    spans: spans.map((span) => ({
      ...span,
      ...Object.fromEntries(marks.filter(([key]) => span[key as keyof Span] === undefined)),
    })),
  }
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

export function textOfLook(
  look: AgentLook,
  now: Text | undefined,
  fallback: TextStyleName,
  theme?: Theme,
): Text | undefined {
  if (look.padding === undefined && textKeys.every((key) => look[key] === undefined)) return undefined
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
            ...(now.language === undefined ? {} : { language: now.language }),
            alignV: now.alignV,
            ...(now.wrap === "words" ? { wrap: now.wrap } : {}),
            ...(now.padding === undefined ? {} : { padding: now.padding }),
            ...(now.overflow === undefined ? {} : { overflow: now.overflow }),
          }
  }
  const align = look.align ?? (replacing ? uniformAlign(now) : undefined)
  if (align !== undefined) text = { ...text, paras: text.paras.map((para) => ({ ...para, align })) }
  const color = look.color !== undefined ? colorOf(look.color) : replacing ? uniformColor(now) : undefined
  if (color !== undefined) text = coloured(text, color)
  if (replacing) text = keptMarks(text, now, keeping)
  const patch = { ...(keeping ? keptLook(now) : {}), ...askedLook(look) }
  if (Object.keys(patch).length > 0) text = lookWrite(text, patch)
  const lineHeight = look.lineHeight ?? (keeping ? keptLineHeight(now) : undefined)
  const para: Para = {
    ...(lineHeight === undefined ? {} : { lineHeight }),
    ...(look.spaceBefore === undefined ? {} : { spaceBefore: look.spaceBefore }),
    ...(look.spaceAfter === undefined ? {} : { spaceAfter: look.spaceAfter }),
  }
  if (Object.keys(para).length > 0) text = paraWrite(text, para)
  if (look.weight !== undefined) text = weightOn(text, look.weight, look.font, theme)
  if (look.padding !== undefined) text = { ...text, padding: sidesOf(look.padding) }
  if (look.language !== undefined) text = { ...text, language: look.language }
  return look.alignV === undefined ? text : { ...text, alignV: look.alignV }
}

function weightOn(text: Text, weight: WeightName, askedFont: string | undefined, theme: Theme | undefined): Text {
  if (text.chars.length === 0) return text
  const slot = theme?.textStyles[text.style].font
  const themeFont = slot === undefined || theme === undefined ? undefined : theme.fonts[slot]
  const spans = text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
  return {
    ...text,
    spans: spans.map((span) => {
      const family = familyOf(askedFont ?? span.font ?? themeFont ?? theme?.fonts.body ?? defaultTheme.fonts.body)
      const stored = storedFace(family, weight)
      const next = { ...span, bold: stored.bold }
      if (stored.font === themeFont) {
        const { font: _font, ...rest } = next
        return rest
      }
      return { ...next, font: stored.font }
    }),
  }
}
