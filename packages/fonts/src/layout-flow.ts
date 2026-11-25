import type { FontLayout, FontLayoutEngine, ShapedLine } from "./layout-contract.js"

const trailing = / +$/u
const printableAscii = /^[ -~]*$/u
const url = /https?:\/\/[^\s]+/giu

function firstAfter(offsets: readonly number[], target: number): number {
  let low = 0
  let high = offsets.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (offsets[mid]! <= target) low = mid + 1
    else high = mid
  }
  return low
}

export function flowWith(layout: FontLayout, directionOf: (text: string) => "ltr" | "rtl"): FontLayoutEngine["flow"] {
  return ({ paragraph, width, emergency, twoLines, missingFace }) => {
    const { text } = paragraph
    const direction = paragraph.direction === "auto" ? directionOf(text) : paragraph.direction
    const atSource = (offset: number) => paragraph.sourceOffsetByTextOffset[offset] ?? offset
    const shape = (start: number, end: number): ShapedLine | undefined => {
      const ink = text.slice(start, end).replace(trailing, "")
      const range = { start, end: start + ink.length }
      const lineEnding = end < text.length && ink.endsWith("\u00ad") ? "discretionary-hyphen" : "plain"
      const input = { paragraph, range, lineEnding, missingFace } satisfies Parameters<FontLayout["shapeLine"]>[0]
      const line = layout.shapeLine({ ...input, contextualSpacing: true })
      if (line.kind !== "shaped") return undefined
      return { ...line, range: { start: atSource(start), end: atSource(end) } }
    }
    if (!twoLines && (width === Infinity || printableAscii.test(text))) {
      const line = shape(0, text.length)
      if (width === Infinity || (line !== undefined && line.advance <= width))
        return line === undefined ? undefined : { direction, lines: [line] }
    }
    const { opportunities, graphemes } = layout.breaks(paragraph)
    const boundaries = new Set(graphemes)
    const urls = [...text.matchAll(url)].map((match) => ({ start: match.index, end: match.index + match[0].length }))
    const insideUrl = (end: number) => urls.some((token) => token.start < end && end < token.end)
    const ends = opportunities.filter((end) => end > 0 && boundaries.has(end) && !insideUrl(end))
    if (ends.at(-1) !== text.length) ends.push(text.length)

    let twoLineWidth: number | undefined
    if (twoLines && ends.length > 1) {
      let low = 0
      let high = ends.length - 2
      while (low <= high) {
        const mid = (low + high) >>> 1
        const end = ends[mid]!
        const left = shape(0, end)
        const right = shape(end, text.length)
        if (left === undefined || right === undefined) return undefined
        const wider = Math.max(left.advance, right.advance)
        twoLineWidth = Math.min(twoLineWidth ?? wider, wider)
        if (left.advance < right.advance) low = mid + 1
        else high = mid - 1
      }
    }

    function fit(start: number, candidates: readonly number[], first: number, last: number) {
      let low = first
      let high = last
      let count = 1
      let pass: { readonly at: number; readonly line: ShapedLine } | undefined
      while (low <= high) {
        const at = Math.min(high, low + count - 1)
        const line = shape(start, candidates[at]!)
        if (line === undefined) return undefined
        if (line.advance <= width) {
          pass = { at, line }
          low = at + 1
          count *= 2
        } else {
          high = at - 1
          count = Math.max(1, Math.ceil((high - low + 1) / 2))
          if (pass === undefined && at === first) return { at, line }
        }
      }
      return pass
    }

    const lines: ShapedLine[] = []
    let start = 0
    let next = 0
    let grapheme = 1
    let emergencyEnd = 0
    while (next < ends.length) {
      if (start < emergencyEnd) {
        while (graphemes[grapheme]! <= start) grapheme++
        const last = firstAfter(graphemes, emergencyEnd) - 1
        const short = fit(start, graphemes, grapheme, last)
        if (short === undefined) return undefined
        start = graphemes[short.at]!
        lines.push(short.line)
        if (start === emergencyEnd) next++
        continue
      }
      const best = fit(start, ends, next, ends.length - 1)
      if (best === undefined) return undefined
      const end = ends[best.at]!
      if (emergency && best.line.advance > width && !urls.some((token) => token.start === start)) {
        emergencyEnd = end
        continue
      }
      lines.push(best.line)
      start = end
      next = best.at + 1
    }
    return { direction, lines, ...(twoLineWidth === undefined ? {} : { twoLineWidth }) }
  }
}
