import { graphemes } from "./graphemes.js"
import type { Measure, Measured } from "./measure.js"
import type { ResolvedLine } from "./resolved.js"
import type { Span, Text } from "./text.js"
import type { Theme } from "./theme.js"

function ellipsize(line: ResolvedLine, text: Text, theme: Theme, measure: Measure): ResolvedLine {
  const source = text.chars.slice(line.start, line.end).trimEnd()
  const offsets = [...Array.from(graphemes(source), ({ index }) => index), source.length]
  const prefix = (length: number) => {
    const end = line.start + length
    const spans: Span[] = []
    let start = 0
    for (const span of text.spans) {
      if (span.end > line.start && start < end) spans.push({ ...span, end: Math.min(span.end, end) - line.start })
      start = span.end
      if (start >= end) break
    }
    const near = spans.pop() ?? text.spans.find((span) => span.end > line.start)
    spans.push({ ...near, end: length + 1 })
    const label: Text = {
      chars: source.slice(0, length) + "…",
      spans,
      paras: [{}],
      style: text.style,
      resize: "fixed",
      alignV: "top",
      ...(text.wrap === undefined ? {} : { wrap: text.wrap }),
    }
    return measure(label, theme, null).lines[0]
  }

  let best: ResolvedLine | undefined
  let low = 0
  let high = offsets.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const picked = prefix(offsets[middle]!)
    if (picked !== undefined && picked.ink <= line.w) {
      best = picked
      low = middle + 1
    } else high = middle - 1
  }
  return { ...line, align: line.align === "justify" ? "left" : line.align, ink: best?.ink ?? 0, runs: best?.runs ?? [] }
}

export function ellipsized(measured: Measured, text: Text, theme: Theme, height: number, measure: Measure): Measured {
  const bottom = text.padding?.b ?? 0
  const stop = measured.lines.findIndex((line) => line.y + line.h + bottom > height)
  const visible = stop === -1 ? measured.lines : measured.lines.slice(0, stop)
  if (stop === -1 && visible.every((line) => line.ink <= line.w)) return measured
  const lines = visible.map((line, index) =>
    line.ink > line.w || (stop !== -1 && index === visible.length - 1) ? ellipsize(line, text, theme, measure) : line,
  )
  const last = lines.at(-1)
  return { ...measured, lines, h: last === undefined ? 0 : last.y + last.h + bottom }
}
