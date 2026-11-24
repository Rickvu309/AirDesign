import type { Color, Para, Span, Text, TextStyleName, Theme } from "@airdesign/doom"
import { boldWeight, familyName, namedFace, nearestWeight, regularWeight, typefaceFor } from "@airdesign/fonts"
import { hundredths, wholeFraction } from "./design-values"

export type TextLook = {
  readonly size: number
  readonly font: string
  readonly weight: number
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly color: Color
  readonly tracking: number
  readonly case: "none" | "upper" | "lower" | "title"
}

export function weightOf(font: string, styleWeight: number, bold: boolean | undefined): number {
  if (bold === true) return boldWeight
  const face = namedFace(font)
  if (bold === false && face === undefined) return regularWeight
  return nearestWeight(face?.weight ?? styleWeight)
}

function lookFrom(
  font: string,
  style: Theme["textStyles"][TextStyleName],
  span: Span | undefined,
): TextLook {
  const weight = weightOf(font, style.weight, span?.bold)
  return {
    size: span?.size ?? style.size,
    font: familyName(font),
    weight,
    bold: weight === boldWeight,
    italic: span?.italic ?? false,
    underline: span?.underline ?? false,
    strike: span?.strike ?? false,
    color: span?.color ?? { var: "text" },
    tracking: span?.tracking ?? style.tracking,
    case: span?.case ?? style.case ?? "none",
  }
}

export function looksOf(text: Text, theme: Theme): readonly TextLook[] {
  const style = theme.textStyles[text.style]
  const themeFont = theme.fonts[style.font]
  if (text.spans.length === 0) return [lookFrom(themeFont, style, undefined)]
  return text.spans.map((span) => lookFrom(span.font ?? themeFont, style, span))
}

function spanWithoutFont({ font: _, ...span }: Span): Span {
  return span
}

export function textWithWeight(
  text: Text,
  theme: Theme,
  picked: { readonly weight: number; readonly italic: boolean },
): Text {
  const length = text.chars.length
  if (length === 0) return text
  const style = theme.textStyles[text.style]
  const themeFont = theme.fonts[style.font]
  const base = text.spans.length === 0 ? [{ end: length }] : text.spans
  return {
    ...text,
    spans: base.map((span) => {
      const stored = typefaceFor(familyName(span.font ?? themeFont), picked.weight)
      const next = { ...span, bold: stored.bold, italic: picked.italic }
      return stored.font === themeFont ? spanWithoutFont(next) : { ...next, font: stored.font }
    }),
  }
}

export type TextShown = {
  readonly style: TextStyleName
  readonly look: { readonly [K in keyof TextLook]: { readonly value: TextLook[K]; readonly mixed: boolean } }
  readonly align: { readonly value: NonNullable<Para["align"]>; readonly mixed: boolean }
  readonly list: { readonly value: "none" | "bullets" | "numbers"; readonly mixed: boolean }
  readonly lineHeight: { readonly value: number; readonly mixed: boolean }
}

function agreed<T>(values: readonly T[]): { readonly value: T; readonly mixed: boolean } {
  const [first] = values
  if (first === undefined) throw new Error("No values")
  const key = JSON.stringify(first)
  return { value: first, mixed: values.some((value) => JSON.stringify(value) !== key) }
}

export function shownText(text: Text, theme: Theme): TextShown {
  const looks = looksOf(text, theme)
  const pick = <K extends keyof TextLook>(key: K) => agreed(looks.map((look) => look[key]))
  const style = theme.textStyles[text.style]
  return {
    style: text.style,
    look: {
      size: pick("size"),
      font: pick("font"),
      weight: pick("weight"),
      bold: pick("bold"),
      italic: pick("italic"),
      underline: pick("underline"),
      strike: pick("strike"),
      color: pick("color"),
      tracking: pick("tracking"),
      case: pick("case"),
    },
    align: agreed(text.paras.map((para) => para.align ?? "left")),
    list: agreed(
      text.paras.map((para) => (para.list === "bullet" ? "bullets" : para.list === "number" ? "numbers" : "none")),
    ),
    lineHeight: agreed(text.paras.map((para) => para.lineHeight ?? style.lineHeight)),
  }
}

export const sizeToHundredths = (px: number): number => Math.round(px * hundredths)
export const sizeFromHundredths = (stored: number): number => stored / hundredths
export const lineToFraction = (multiple: number): number => Math.round(multiple * wholeFraction)
export const lineFromFraction = (stored: number): number => stored / wholeFraction
