import type { ResolvedParagraph, ResolvedText, Spacing } from "./resolved-slide.js"

export type FontFace = {
  readonly ascent: number
  readonly descent: number
  readonly advances: Readonly<Record<string, number>>
  readonly kerning?: Readonly<Record<string, number>>
}

export type FontWidths = Readonly<Record<string, FontFace>>

export type TextLine = {
  readonly top: number
  readonly bottom: number
  readonly glyphTop: number
  readonly glyphBottom: number
  readonly left: number
  readonly right: number
}

export type TextLayout = {
  readonly height: number
  readonly room: number
  readonly lines: readonly TextLine[]
}

export type Unjudged = "vertical" | "face" | "glyph" | "tab" | "script"

type Sized = { readonly size: number; readonly face: FontFace | undefined; readonly line: number }
type Glyph = { readonly char: string; readonly width: number; readonly run: number }
type Span = { readonly start: number; readonly end: number; readonly forced: boolean }
type Band = { readonly top: number; readonly bottom: number }

const emuPerPoint = 12_700
const singleLine = 1.2
const tolerance = 1e-6
const forced = "\n"
const space = " "

export function fontFace(font: string, bold: boolean, italic: boolean): string {
  return [font, ...(bold ? ["bold"] : []), ...(italic ? ["italic"] : [])].join("|")
}

function judged(code: number): boolean {
  if (code < 0x20) return false
  if (code === 0xad) return false
  if (code < 0x300) return true
  if (code < 0x370) return false
  if (code >= 0x483 && code < 0x48a) return false
  if (code < 0x590) return true
  if (code >= 0x1e00 && code < 0x2000) return true
  if (code === 0x200c || code === 0x200d || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069))
    return false
  if (code >= 0x2000 && code < 0x2c00) return true
  return code >= 0xe000 && code < 0xf900
}

function share(percent: number): number {
  return Math.round(percent * singleLine * 10_000) / 10_000
}

function reduced(spacing: Spacing | null, factor: number): Spacing | null {
  if (spacing === null) return factor === 1 ? null : { percent: factor }
  return "percent" in spacing ? { percent: spacing.percent * factor } : { points: spacing.points * factor }
}

function lineOf(spacing: Spacing | null, size: number): number {
  if (spacing === null) return share(1) * size
  return "percent" in spacing ? share(spacing.percent) * size : spacing.points
}

function gapOf(spacing: Spacing | null, largest: number): number {
  if (spacing === null) return 0
  return "percent" in spacing ? largest * spacing.percent : spacing.points
}

function extent(line: number, face: FontFace | undefined, size: number): Band {
  const lift = face === undefined ? 0 : (face.ascent - face.descent) * size
  return { top: (line + lift) / 2, bottom: (line - lift) / 2 }
}

function alphanumeric(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

function breaksAfter(chars: readonly string[], at: number): boolean {
  const char = chars[at]
  const next = chars[at + 1]
  if (next === undefined) return false
  if (char === forced || char === "​") return true
  if (char === space) return next !== space
  if (next === space) return false
  if (char === "-") return at > 0 && chars[at - 1] !== space && alphanumeric(next)
  if (char === "‐" || char === "–") return true
  if (char === "—") return next !== "—"
  return next === "—"
}

function measured(face: FontFace, text: string, size: number): number | Unjudged {
  let width = 0
  let previous: string | undefined
  for (const char of text) {
    const advance = face.advances[char]
    if (advance === undefined) return "glyph"
    width += (advance + (previous === undefined ? 0 : (face.kerning?.[previous + char] ?? 0))) * size
    previous = char
  }
  return width
}

type Paragraph = {
  readonly sized: readonly Sized[]
  readonly glyphs: readonly Glyph[]
  readonly empties: readonly { readonly run: number; readonly at: number }[]
}

function glyphsOf(paragraph: ResolvedParagraph, text: ResolvedText, widths: FontWidths): Paragraph | Unjudged {
  const spacing = reduced(paragraph.lineSpacing, 1 - text.lineReduction)
  const sized: Sized[] = []
  const glyphs: Glyph[] = []
  const empties: { run: number; at: number }[] = []
  for (const [index, run] of paragraph.runs.entries()) {
    const size = run.size * text.fontScale
    const face = widths[fontFace(run.font, run.bold, run.italic)]
    sized.push({ size, face, line: lineOf(spacing, size) })
    if (run.text === "") empties.push({ run: index, at: glyphs.length })
    let previous: string | undefined
    for (const char of run.text) {
      if (char === "\t") return "tab"
      if (char === forced) {
        glyphs.push({ char, width: 0, run: index })
        previous = undefined
        continue
      }
      if (!judged(char.codePointAt(0) ?? 0)) return "script"
      if (face === undefined) return "face"
      const advance = face.advances[char]
      if (advance === undefined) return "glyph"
      const kern = previous === undefined ? 0 : (face.kerning?.[previous + char] ?? 0)
      glyphs.push({ char, width: (advance + kern) * size, run: index })
      previous = char
    }
  }
  return { sized, glyphs, empties }
}

function spansOf(glyphs: readonly Glyph[], first: number, rest: number): readonly Span[] {
  const chars = glyphs.map((glyph) => glyph.char)
  const spans: Span[] = []
  let start = 0
  let width = 0
  let has = false
  let room = first
  const close = (end: number, hard: boolean) => {
    spans.push({ start, end, forced: hard })
    start = end
    width = 0
    has = false
    room = rest
  }
  let from = 0
  while (from < glyphs.length) {
    let to = from
    while (to < glyphs.length - 1 && !breaksAfter(chars, to)) to += 1
    let content = 0
    let full = 0
    let tail = 0
    for (let at = from; at <= to; at += 1) {
      const glyph = glyphs[at]
      if (glyph === undefined) continue
      full += glyph.width
      tail = glyph.char === space || glyph.char === forced ? tail + glyph.width : 0
    }
    content = full - tail
    if (has && width + content > room + tolerance) close(from, false)
    if (!has && content > room + tolerance) {
      for (let at = from; at <= to; at += 1) {
        const glyph = glyphs[at]
        if (glyph === undefined) continue
        const blank = glyph.char === space || glyph.char === forced
        if (has && !blank && width + glyph.width > room + tolerance) close(at, false)
        width += glyph.width
        has = true
      }
    } else {
      width += full
      has = true
    }
    if (chars[to] === forced) close(to + 1, true)
    from = to + 1
  }
  if (has || spans.length === 0) spans.push({ start, end: glyphs.length, forced: false })
  return spans
}

function inkWidth(glyphs: readonly Glyph[], span: Span): number {
  let width = 0
  let tail = 0
  for (let at = span.start; at < span.end; at += 1) {
    const glyph = glyphs[at]
    if (glyph === undefined) continue
    width += glyph.width
    tail = glyph.char === space || glyph.char === forced ? tail + glyph.width : 0
  }
  return width - tail
}

type Placed = { readonly lines: readonly TextLine[]; readonly height: number }

function placeParagraph(
  paragraph: ResolvedParagraph,
  text: ResolvedText,
  widths: FontWidths,
  inner: number,
): Placed | Unjudged {
  const laid = glyphsOf(paragraph, text, widths)
  if (typeof laid === "string") return laid
  const { sized, glyphs, empties } = laid
  const margin = paragraph.marginLeft / emuPerPoint
  const indent = paragraph.indent / emuPerPoint
  const filled = paragraph.runs.some((run) => run.text !== "")
  const bullet = filled ? paragraph.bullet : null
  const bulletSize = (bullet?.size ?? 0) * text.fontScale
  const bulletFace = bullet === null ? undefined : widths[fontFace(bullet.font, false, false)]
  if (bullet !== null && bulletFace === undefined) return "face"
  const label = bullet === null || bulletFace === undefined ? 0 : measured(bulletFace, bullet.text, bulletSize)
  if (typeof label === "string") return label
  const hang = bullet === null ? 0 : indent < 0 ? Math.max(-indent, label) : label
  const lead = indent + hang
  const spans = spansOf(glyphs, inner - margin - lead, inner - margin)
  const endSize = paragraph.end.size * text.fontScale
  const endFace = widths[fontFace(paragraph.end.font, false, false)]
  const spacing = reduced(paragraph.lineSpacing, 1 - text.lineReduction)
  const strut = extent(filled ? 0 : lineOf(spacing, endSize), endFace, endSize)
  const largest = Math.max(endSize, ...sized.map((run) => run.size))
  let y = gapOf(paragraph.spaceBefore, largest)
  const lines: TextLine[] = []
  for (const [index, span] of spans.entries()) {
    const present = new Set<number>()
    for (let at = span.start; at < span.end; at += 1) present.add(glyphs[at]?.run ?? -1)
    for (const empty of empties)
      if ((index === 0 && empty.at === 0) || (empty.at > span.start && empty.at <= span.end)) present.add(empty.run)
    let top = endFace === undefined && filled ? 0 : strut.top
    let bottom = endFace === undefined && filled ? 0 : strut.bottom
    let ascent = 0
    let descent = 0
    for (const run of present) {
      const style = sized[run]
      if (style === undefined) continue
      const band = extent(style.line, style.face, style.size)
      top = Math.max(top, band.top)
      bottom = Math.max(bottom, band.bottom)
      ascent = Math.max(ascent, (style.face?.ascent ?? 0) * style.size)
      descent = Math.max(descent, (style.face?.descent ?? 0) * style.size)
    }
    if (index === 0 && bullet !== null) {
      const band = extent(bulletSize, bulletFace, bulletSize)
      top = Math.max(top, band.top)
      bottom = Math.max(bottom, band.bottom)
    }
    const words = inkWidth(glyphs, span)
    const start = index === 0 ? indent : 0
    const used = (index === 0 ? hang : 0) + words
    const room = inner - margin - start
    const stretched = (paragraph.align === "justify" || paragraph.align === "distributed") && index < spans.length - 1
    const free = stretched ? 0 : room - used
    const shift = paragraph.align === "center" ? free / 2 : paragraph.align === "right" ? free : 0
    const left = margin + start + shift
    const right = stretched ? inner : left + used
    const baseline = y + top
    const shown = used > 0
    lines.push({
      top: y,
      bottom: y + top + bottom,
      glyphTop: shown ? baseline - ascent : baseline,
      glyphBottom: shown ? baseline + descent : baseline,
      left,
      right: shown ? right : left,
    })
    y += top + bottom
  }
  return { lines, height: y + gapOf(paragraph.spaceAfter, largest) }
}

function edged(paragraph: ResolvedParagraph, at: number, text: ResolvedText): ResolvedParagraph {
  if (text.edgeSpacing === true) return paragraph
  return {
    ...paragraph,
    ...(at === 0 ? { spaceBefore: null } : {}),
    ...(at === text.paragraphs.length - 1 ? { spaceAfter: null } : {}),
  }
}

export function layText(
  text: ResolvedText,
  box: { readonly cx: number; readonly cy: number },
  widths: FontWidths,
): TextLayout | Unjudged {
  if (text.vertical) return "vertical"
  const { insets } = text
  const inner = (box.cx - insets.left - insets.right) / emuPerPoint
  const room = (box.cy - insets.top - insets.bottom) / emuPerPoint
  const lines: TextLine[] = []
  let height = 0
  for (const [at, paragraph] of text.paragraphs.entries()) {
    const placed = placeParagraph(edged(paragraph, at, text), text, widths, inner)
    if (typeof placed === "string") return placed
    for (const line of placed.lines)
      lines.push({
        ...line,
        top: line.top + height,
        bottom: line.bottom + height,
        glyphTop: line.glyphTop + height,
        glyphBottom: line.glyphBottom + height,
      })
    height += placed.height
  }
  const offset = text.anchor === "middle" ? (room - height) / 2 : text.anchor === "bottom" ? room - height : 0
  const down = insets.top / emuPerPoint + offset
  const across = insets.left / emuPerPoint
  return {
    height,
    room,
    lines: lines.map((line) => ({
      top: line.top + down,
      bottom: line.bottom + down,
      glyphTop: line.glyphTop + down,
      glyphBottom: line.glyphBottom + down,
      left: line.left + across,
      right: line.right + across,
    })),
  }
}
