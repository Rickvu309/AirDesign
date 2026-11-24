import type { Color, Para, Text, TextStyleName, Theme } from "@airdesign/doom"
import { hundredths, wholeFraction } from "./design-values"

const boldFrom = 600

export type TextLook = {
  readonly size: number
  readonly font: string
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly color: Color
  readonly tracking: number
  readonly case: "none" | "upper" | "lower" | "title"
}

export function looksOf(text: Text, theme: Theme): readonly TextLook[] {
  const style = theme.textStyles[text.style]
  const base: TextLook = {
    size: style.size,
    font: theme.fonts[style.font],
    bold: style.weight >= boldFrom,
    italic: false,
    underline: false,
    strike: false,
    color: { var: "text" },
    tracking: style.tracking,
    case: style.case ?? "none",
  }
  if (text.spans.length === 0) return [base]
  return text.spans.map((span) => ({
    size: span.size ?? base.size,
    font: span.font ?? base.font,
    bold: span.bold ?? base.bold,
    italic: span.italic ?? base.italic,
    underline: span.underline ?? base.underline,
    strike: span.strike ?? base.strike,
    color: span.color ?? base.color,
    tracking: span.tracking ?? base.tracking,
    case: span.case ?? base.case,
  }))
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
