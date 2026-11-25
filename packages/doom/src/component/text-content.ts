import type { Color } from "../paint.js"
import { boolean, finite, list, literal, object } from "../read-kit.js"
import type { Para, Span } from "../text.js"
import { color, isList, string, type Charge, type Value } from "./values.js"

const paragraph = object(
  { chars: string },
  { color, scale: finite(0.1, 1), bold: boolean, wrap: literal(["none"]), spaceBefore: finite(0, 1_000) },
)

export function textContent(
  value: Value,
  ink: Color,
  align: NonNullable<Para["align"]>,
  size: number,
  charge: Charge,
): { readonly chars: string; readonly spans: readonly Span[]; readonly paras: readonly Para[] } {
  if (!isList(value)) {
    const chars = string(value)
    const lines = chars.split("\n")
    charge(chars.length + 16 * lines.length)
    return {
      chars,
      spans: chars === "" ? [] : [{ end: chars.length, color: ink }],
      paras: lines.map(() => ({ align })),
    }
  }

  const spans: Span[] = []
  const paras: Para[] = []
  let chars = ""
  for (const { chars: words, color, scale, bold, ...para } of list(paragraph, 16, 1)(value)) {
    const lines = para.wrap === "none" ? [words.replaceAll("\n", " ")] : words.split("\n")
    charge(words.length + 16 * lines.length)
    if (paras.length > 0) chars += "\n"
    chars += lines.join("\n")
    if (chars.length > 0) {
      spans.push({
        end: chars.length,
        color: color ?? ink,
        ...(scale === undefined ? {} : { size: Math.max(1, size * scale) }),
        ...(bold === undefined ? {} : { bold }),
      })
    }
    paras.push(...lines.map(() => ({ align, ...para })))
  }
  return { chars, spans, paras }
}
