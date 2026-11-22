import type { scene } from "@airdesign/document"
import { hundredths, wholeFraction } from "./design-values"

const boldFrom = 600

export type TextLook = {
  readonly size: number
  readonly font: string
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly color: scene.Color
  readonly tracking: number
  readonly case: "none" | "upper" | "lower" | "title"
}

export function looksOf(text: scene.Text, theme: scene.Theme): readonly TextLook[] {
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
  readonly style: scene.TextStyleName
  readonly look: { readonly [K in keyof TextLook]: { readonly value: TextLook[K]; readonly mixed: boolean } }
  readonly align: { readonly value: NonNullable<scene.Para["align"]>; readonly mixed: boolean }
  readonly list: { readonly value: "none" | "bullets" | "numbers"; readonly mixed: boolean }
  readonly lineHeight: { readonly value: number; readonly mixed: boolean }
}

function agreed<T>(values: readonly T[]): { readonly value: T; readonly mixed: boolean } {
  const [first] = values
  if (first === undefined) throw new Error("No values")
  const key = JSON.stringify(first)
  return { value: first, mixed: values.some((value) => JSON.stringify(value) !== key) }
}

export function shownText(text: scene.Text, theme: scene.Theme): TextShown {
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

export type LookPatch = { readonly [K in keyof TextLook]?: TextLook[K] }

function withSpans(text: scene.Text, change: (span: scene.Span) => scene.Span): scene.Text {
  const length = text.chars.length
  if (length === 0) return text
  const base: readonly scene.Span[] = text.spans.length === 0 ? [{ end: length }] : text.spans
  return { ...text, spans: base.map(change) }
}

function without(span: scene.Span, keys: readonly (keyof scene.Span)[]): scene.Span {
  const kept = { ...span }
  for (const key of keys) delete (kept as Record<string, unknown>)[key]
  return kept
}

export function lookWrite(text: scene.Text, patch: LookPatch): scene.Text {
  return withSpans(text, (span) => {
    let next: scene.Span = span
    if (patch.size !== undefined) next = { ...next, size: patch.size }
    if (patch.font !== undefined) next = { ...next, font: patch.font }
    if (patch.bold !== undefined) next = { ...next, bold: patch.bold }
    if (patch.italic !== undefined) next = { ...next, italic: patch.italic }
    if (patch.underline !== undefined) next = { ...next, underline: patch.underline }
    if (patch.strike !== undefined) next = { ...next, strike: patch.strike }
    if (patch.color !== undefined) next = { ...next, color: patch.color }
    if (patch.tracking !== undefined) next = { ...next, tracking: patch.tracking }
    if (patch.case !== undefined) next = patch.case === "none" ? without(next, ["case"]) : { ...next, case: patch.case }
    return next
  })
}

export function paraWrite(text: scene.Text, patch: scene.Para): scene.Text {
  return { ...text, paras: text.paras.map((para) => ({ ...para, ...patch })) }
}

export function styleWrite(text: scene.Text, style: scene.TextStyleName): scene.Text {
  const reset = withSpans(text, (span) => without(span, ["size", "font", "bold", "tracking", "case"]))
  return {
    ...reset,
    style,
    paras: reset.paras.map((para) => {
      const { lineHeight: _lineHeight, ...rest } = para
      return rest
    }),
  }
}

export const sizeOld = (px: number): number => Math.round(px * hundredths)
export const sizeNew = (old: number): number => old / hundredths
export const lineOld = (multiple: number): number => Math.round(multiple * wholeFraction)
export const lineNew = (old: number): number => old / wholeFraction
