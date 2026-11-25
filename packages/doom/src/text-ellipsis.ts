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

export function paragraphCuts(text: Text, lines: readonly ResolvedLine[]): ReadonlySet<number> {
  const cuts = new Set<number>()
  if (!text.paras.some((para) => para.maxLines !== undefined)) return cuts
  let index = 0
  let end = text.chars.indexOf("\n")
  let lineInParagraph = 0
  for (const [i, line] of lines.entries()) {
    while (end !== -1 && line.start > end) {
      index += 1
      end = text.chars.indexOf("\n", end + 1)
      lineInParagraph = 0
    }
    lineInParagraph += 1
    const limit = text.paras[index]?.maxLines ?? Infinity
    if (lineInParagraph > limit) cuts.add(i)
  }
  return cuts
}

export function ellipsized(measured: Measured, text: Text, theme: Theme, height: number, measure: Measure): Measured {
  const bottom = text.padding?.b ?? 0
  const cuts = paragraphCuts(text, measured.lines)
  let lifted = 0
  let shortened = false
  const lines: ResolvedLine[] = []
  for (const [i, line] of measured.lines.entries()) {
    if (cuts.has(i)) {
      lifted += line.h
      continue
    }
    const y = line.y - lifted
    if (y + line.h + bottom > height) {
      const last = lines.pop()
      if (last !== undefined) lines.push(ellipsize(last, text, theme, measure))
      shortened = true
      break
    }
    const placed = lifted === 0 ? line : { ...line, y }
    if (line.ink > line.w || cuts.has(i + 1)) {
      lines.push(ellipsize(placed, text, theme, measure))
      shortened = true
    } else lines.push(placed)
  }
  if (!shortened) return measured
  const last = lines.at(-1)
  return { ...measured, lines, h: last === undefined ? 0 : last.y + last.h + bottom }
}
