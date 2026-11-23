import type { Color, Px } from "./paint.js"
import type { Para, Span, Text, TextStyleName } from "./text.js"

export type TextPatch = {
  readonly size?: Px
  readonly font?: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strike?: boolean
  readonly color?: Color
  readonly tracking?: Px
  readonly case?: "none" | "upper" | "lower" | "title"
}

function withSpans(text: Text, change: (span: Span) => Span): Text {
  const length = text.chars.length
  if (length === 0) return text
  const base: readonly Span[] = text.spans.length === 0 ? [{ end: length }] : text.spans
  return { ...text, spans: base.map(change) }
}

function without(span: Span, keys: readonly (keyof Span)[]): Span {
  const kept = { ...span }
  for (const key of keys) delete (kept as Record<string, unknown>)[key]
  return kept
}

export function lookWrite(text: Text, patch: TextPatch): Text {
  return withSpans(text, (span) => {
    let next: Span = span
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

export function paraWrite(text: Text, patch: Para): Text {
  return { ...text, paras: text.paras.map((para) => ({ ...para, ...patch })) }
}

export function styleWrite(text: Text, style: TextStyleName): Text {
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
