import { field } from "./intent-fields.js"
import { readLink } from "./link.js"
import { limits } from "./limits.js"
import { integer, mismatch, object, words } from "./read-kit.js"
import type { Span, Text } from "./text.js"

export type IntentInsert = { readonly at: number; readonly text: string; readonly link: string }

export const insertField = field(
  {
    type: "object",
    additionalProperties: false,
    required: ["at", "text", "link"],
    properties: {
      at: { type: "integer", minimum: 0 },
      text: { type: "string" },
      link: { type: "string" },
    },
  },
  (raw) => {
    const read = object({ at: integer(0, limits.valueBytes), text: words(limits.valueBytes, 1), link: readLink })(raw)
    if (read.text.includes("\n")) mismatch("text", { code: "single-line" })
    return read
  },
)

function covered(text: Text): readonly Span[] {
  return text.spans.length === 0 ? [{ end: text.chars.length }] : text.spans
}

export function insertLinkedRun(text: Text, at: number, words: string, link: string): Text {
  const offset = Math.min(Math.max(0, at), text.chars.length)
  const added = words.length
  const chars = text.chars.slice(0, offset) + words + text.chars.slice(offset)
  const spans: Span[] = []
  let start = 0
  let placed = false
  for (const span of covered(text)) {
    if (!placed && offset <= span.end) {
      if (offset > start) spans.push({ ...span, end: offset })
      spans.push({ end: offset + added, link })
      if (span.end > offset) spans.push({ ...span, end: span.end + added })
      placed = true
    } else spans.push(placed ? { ...span, end: span.end + added } : span)
    start = span.end
  }
  if (!placed) spans.push({ end: offset + added, link })
  return { ...text, chars, spans }
}
