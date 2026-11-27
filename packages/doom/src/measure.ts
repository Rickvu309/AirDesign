import { graphemes } from "./graphemes.js"
import { type FontWidths, type Glyph, fontFace, isCjk, spansOf, wordBoundary } from "./line-breaks.js"
import { paintedFace } from "./painted-face.js"
import { resolveColor } from "./color.js"
import type { Px } from "./paint.js"
import type { ResolvedFace, ResolvedLine, ResolvedRun } from "./resolved.js"
import type { Para, Span, Text } from "./text.js"
import { estimateAdvance } from "./text-estimate.js"
import { type Theme, textFont } from "./theme.js"

type WordFit = { readonly w: Px; readonly h: Px }
export type Measured = {
  readonly w: Px
  readonly h: Px
  readonly lines: readonly ResolvedLine[]
  readonly wordFit?: WordFit
}
export type Measure = (text: Text, theme: Theme, width: Px | null, fit?: "two-lines") => Measured

type ProbedRun = Pick<ResolvedRun, "font" | "bold" | "italic" | "size" | "tracking" | "figures"> & {
  readonly range: { readonly start: number; readonly end: number }
}

type MeasureParagraph = {
  readonly locale?: string
  readonly text: string
  readonly runs: readonly ProbedRun[]
  readonly sourceOffsetByTextOffset: readonly number[]
  readonly width: number
}

export type MeasureProbe = (
  paragraph: MeasureParagraph & {
    readonly lines: readonly Pick<ResolvedLine, "start" | "end" | "ink">[]
  },
) => void

type ShapedParagraph = {
  readonly locale?: string
  readonly direction: "ltr" | "rtl"
  readonly pending?: true
  readonly twoLineWidth?: number
  readonly lines: readonly {
    readonly start: number
    readonly end: number
    readonly advance: number
    readonly faces: readonly {
      readonly start: number
      readonly end: number
      readonly face: ResolvedFace
    }[]
    readonly display?: string
  }[]
}

export type MeasureLayout = (
  paragraph: MeasureParagraph & {
    readonly emergency: boolean
    readonly twoLines: boolean
  },
) => ShapedParagraph | undefined

const fallbackAdvance = 0.55
const listStep = 1.2
const space = " "

type Look = Omit<ResolvedRun, "text">
type Cased = "upper" | "lower" | "title" | null

type CasedLook = Look & { readonly case: Cased }
type Base = CasedLook & { readonly lineHeight: number; readonly styleWeight: number }

const baseLook = (text: Text, theme: Theme): Base => {
  const style = theme.textStyles[text.style]
  const painted = paintedFace(textFont(text, theme), style.weight, undefined)
  return {
    size: style.size,
    font: painted.font,
    bold: painted.bold,
    italic: false,
    underline: false,
    strike: false,
    color: theme.colors.text,
    tracking: style.tracking,
    case: style.case ?? null,
    lineHeight: style.lineHeight,
    styleWeight: style.weight,
  }
}

function lookOf(span: Span | undefined, base: Base, theme: Theme): CasedLook {
  const { lineHeight: _lineHeight, styleWeight, ...look } = base
  if (span === undefined) return look
  const painted = paintedFace(span.font ?? look.font, styleWeight, span.bold)
  return {
    ...look,
    bold: painted.bold,
    ...(span.italic === undefined ? {} : { italic: span.italic }),
    ...(span.underline === undefined ? {} : { underline: span.underline }),
    ...(span.strike === undefined ? {} : { strike: span.strike }),
    ...(span.size === undefined ? {} : { size: span.size }),
    font: painted.font,
    ...(span.color === undefined ? {} : { color: resolveColor(span.color, theme) }),
    ...(span.tracking === undefined ? {} : { tracking: span.tracking }),
    ...(span.case === undefined ? {} : { case: span.case }),
    ...(span.figures === undefined ? {} : { figures: span.figures }),
    ...(span.link === undefined ? {} : { link: span.link }),
  }
}

function cased(char: string, mode: Cased, after: string | undefined): string {
  const turned =
    mode === "upper"
      ? char.toUpperCase()
      : mode === "lower"
        ? char.toLowerCase()
        : mode === "title" && (after === undefined || after === space)
          ? char.toUpperCase()
          : char
  return [...turned].length === [...char].length ? turned : char
}

type Styled = { readonly char: string; readonly at: number; readonly end: number; readonly run: number }

function styledChars(text: Text): readonly (Styled | "break")[] {
  const out: (Styled | "break")[] = []
  let run = 0
  for (const { segment, index: at } of graphemes(text.chars)) {
    while (text.spans[run] !== undefined && at >= text.spans[run]!.end) run += 1
    out.push(segment === "\n" ? "break" : { char: segment, at, end: at + segment.length, run })
  }
  return out
}

function paragraphsOf(text: Text): readonly (readonly Styled[])[] {
  const paragraphs: Styled[][] = [[]]
  for (const item of styledChars(text)) {
    if (item === "break") paragraphs.push([])
    else paragraphs[paragraphs.length - 1]!.push(item)
  }
  return paragraphs
}

const trimmedWidth = (glyphs: readonly Glyph[], from: number, to: number): number => {
  let width = 0
  let tail = 0
  for (let at = from; at < to; at += 1) {
    const glyph = glyphs[at]!
    width += glyph.width
    tail = glyph.char === space ? tail + glyph.width : 0
  }
  return width - tail - (glyphs[from]?.join ?? 0)
}

function twoLineWidth(glyphs: readonly Glyph[]): number {
  const total = trimmedWidth(glyphs, 0, glyphs.length)
  let width = 0
  let ink = 0
  let best = Infinity
  for (const [at, glyph] of glyphs.entries()) {
    const previous = glyphs[at - 1]
    if (ink > 0 && previous !== undefined && wordBoundary(previous.char, glyph.char))
      best = Math.min(best, Math.max(ink + (previous.hyphen ?? 0), total - width - (glyph.join ?? 0)))
    width += glyph.width
    if (glyph.char !== space) ink = width
  }
  return best
}

const alignOf = (para: Para | undefined) => para?.align ?? "left"

export function charsByFace(text: Text, theme: Theme): ReadonlyMap<string, ReadonlySet<string>> {
  const base = baseLook(text, theme)
  const looks = (text.spans.length === 0 ? [undefined] : text.spans).map((span) => lookOf(span, base, theme))
  const found = new Map<string, Set<string>>()
  for (const item of styledChars(text)) {
    if (item === "break") continue
    const look = looks[item.run] ?? looks[looks.length - 1]!
    const face = fontFace(look.font, look.bold, look.italic)
    let chars = found.get(face)
    if (chars === undefined) found.set(face, (chars = new Set()))
    chars.add(item.char.normalize("NFC"))
    if (text.overflow === "ellipsis") chars.add("…")
  }
  return found
}

function paragraphOf(
  shown: readonly string[],
  chars: readonly Styled[],
  looks: readonly CasedLook[],
  width: number,
): MeasureParagraph {
  const runs: (Omit<ProbedRun, "range"> & { range: { start: number; end: number } })[] = []
  const offsets: number[] = []
  let text = ""
  for (const [index, part] of shown.entries()) {
    const char = chars[index]!
    const start = text.length
    for (let offset = 0; offset < part.length; offset++) offsets.push(Math.min(char.at + offset, char.end))
    text += part
    const last = runs.at(-1)
    if (last !== undefined && char.run === chars[index - 1]?.run) last.range.end = text.length
    else {
      const { font, bold, italic, size, tracking, figures } = looks[char.run]!
      runs.push({
        font,
        bold,
        italic,
        size,
        tracking,
        ...(figures === undefined ? {} : { figures }),
        range: { start, end: text.length },
      })
    }
  }
  offsets.push(chars.at(-1)?.end ?? 0)
  return { text, runs, sourceOffsetByTextOffset: offsets, width }
}

function shapedRuns(
  paragraph: MeasureParagraph,
  line: ShapedParagraph["lines"][number],
  looks: readonly CasedLook[],
  chars: readonly Styled[],
): ResolvedRun[] {
  const runs: ResolvedRun[] = []
  let style = 0
  let face = 0
  let lookAt = 0
  for (let start = line.start; start < line.end;) {
    while (paragraph.runs[style]!.range.end <= start) style++
    while (line.faces[face] !== undefined && line.faces[face]!.end <= start) face++
    const used = line.faces[face]
    const end = Math.min(line.end, paragraph.runs[style]!.range.end, used?.end ?? line.end)
    const source = paragraph.sourceOffsetByTextOffset[start]!
    while (chars[lookAt]!.end <= source) lookAt++
    const { case: _case, ...paint } = looks[chars[lookAt]!.run]!
    const text = paragraph.text.slice(start, end)
    const display = line.display?.slice(start - line.start, end - line.start)
    const assigned = used?.face ?? runs.at(-1)?.face
    runs.push({
      ...paint,
      text,
      ...(assigned === undefined ? {} : { face: assigned }),
      ...(display === undefined ? {} : { display: display + text.slice(display.length) }),
    })
    start = end
  }
  return runs
}

function measureOnce(widths: FontWidths, probe: MeasureProbe | undefined, layout?: MeasureLayout): Measure {
  return (text, theme, width, fit) => {
    const words = text.wrap === "words" || fit === "two-lines"
    const base = baseLook(text, theme)
    const padding = text.padding ?? { t: 0, r: 0, b: 0, l: 0 }
    const looks = (text.spans.length === 0 ? [undefined] : text.spans).map((span) => lookOf(span, base, theme))
    const faces = looks.map((look) => widths[fontFace(look.font, look.bold, look.italic)])
    const inner =
      width === null || text.wrap === "none" ? Number.POSITIVE_INFINITY : Math.max(0, width - padding.l - padding.r)
    const lines: ResolvedLine[] = []
    const numbers: number[] = []
    let y = padding.t
    let widest = 0
    let paragraphStart = 0
    let wordFit: WordFit | undefined
    for (const [index, chars] of paragraphsOf(text).entries()) {
      const para = text.paras[index]
      const level = para?.list === undefined ? 0 : (para.level ?? 0)
      if (para?.list === "number") {
        numbers.length = level + 1
        numbers[level] = (numbers[level] ?? 0) + 1
      } else numbers.length = 0
      const step = base.size * listStep
      const indent = para?.list === undefined ? 0 : (level + 1) * step
      const room = para?.wrap === "none" ? Infinity : inner - indent
      const shown = chars.map((item, at) => cased(item.char, looks[item.run]!.case, chars[at - 1]?.char))
      const mayFit =
        fit === "two-lines" && text.paras.length === 1 && text.spans.length === 1 && para?.list === undefined
      const paragraph =
        chars.length > 0 &&
        (layout !== undefined ||
          (probe !== undefined && chars.length <= 512 && chars.at(-1)!.end - paragraphStart <= 512))
          ? paragraphOf(shown, chars, looks, room)
          : undefined
      const shaped =
        paragraph === undefined
          ? undefined
          : layout?.({
              ...paragraph,
              ...(text.language === undefined || text.language === "und" ? {} : { locale: text.language }),
              twoLines: mayFit,
              emergency: !words,
            })
      const glyphs: Glyph[] = []
      let previous: { readonly look: CasedLook; readonly char: string } | undefined
      for (const [at, item] of (shaped === undefined ? chars : []).entries()) {
        const look = looks[item.run]!
        const face = faces[item.run]
        const char = shown[at]!
        const sample = char.normalize("NFC")
        if (char === "\u00ad") {
          const hyphen = face?.advances["‐"] ?? face?.advances["-"] ?? fallbackAdvance
          glyphs.push({
            char,
            width: 0,
            run: item.run,
            hyphen: hyphen * look.size + look.tracking,
          })
          continue
        }
        const before = previous?.look
        const kern =
          previous !== undefined &&
          before?.font === look.font &&
          before.bold === look.bold &&
          before.italic === look.italic &&
          before.size === look.size &&
          before.tracking === look.tracking &&
          before.figures === look.figures
            ? ((look.tracking === 0 ? face?.kerning : (face?.trackedKerning ?? face?.kerning))?.[
                previous.char + sample
              ] ?? 0)
            : 0
        const measured =
          (look.figures === "tabular" && /^[0-9]$/u.test(sample) ? face?.advances["0"] : undefined) ??
          face?.advances[sample] ??
          face?.advances[item.char.normalize("NFC")]
        const advance = measured ?? (words ? estimateAdvance(char) : isCjk(char) ? 1 : fallbackAdvance)
        glyphs.push({
          char,
          width: (advance + kern) * look.size + look.tracking,
          ...(kern !== 0 ? { join: kern * look.size } : {}),
          run: item.run,
        })
        previous = { look, char: sample }
      }
      const first = index === 0
      const before = first ? 0 : (para?.spaceBefore ?? 0)
      y += before
      const lineScale = para?.lineHeight ?? base.lineHeight
      if (mayFit) {
        const split = shaped === undefined ? twoLineWidth(glyphs) : (shaped.twoLineWidth ?? Infinity)
        const look = looks[0]
        if (Number.isFinite(split) && look !== undefined)
          wordFit = { w: split + padding.l + padding.r, h: 2 * look.size * lineScale + padding.t + padding.b }
      }
      const paragraphEnd = chars.at(-1)?.end ?? paragraphStart
      const firstLine = lines.length
      const { case: _case, lineHeight: _lineHeight, styleWeight: _styleWeight, ...labelLook } = base
      const label = para?.list === undefined ? undefined : para.list === "bullet" ? "•" : `${String(numbers[level])}.`
      const labelLayout =
        label === undefined
          ? undefined
          : layout?.({
              text: label,
              runs: [{ ...labelLook, range: { start: 0, end: label.length } }],
              sourceOffsetByTextOffset: [],
              width: Infinity,
              emergency: false,
              twoLines: false,
            })
      const labelFace = labelLayout?.lines[0]?.faces[0]?.face
      const spans = shaped?.lines ?? spansOf(glyphs, room, room, words)
      for (const [spanIndex, span] of spans.entries()) {
        const runs = "advance" in span && paragraph !== undefined ? shapedRuns(paragraph, span, looks, chars) : []
        for (let at = span.start; !("advance" in span) && at < span.end; at += 1) {
          const glyph = glyphs[at]!
          const look = looks[glyph.run]!
          const last = runs[runs.length - 1]
          const { case: _case, ...paint } = look
          if (last !== undefined && looks[glyphs[at - 1]!.run] === look)
            runs[runs.length - 1] = { ...last, text: last.text + glyph.char }
          else runs.push({ ...paint, text: glyph.char })
        }
        const lineWidth =
          "advance" in span
            ? span.advance
            : trimmedWidth(glyphs, span.start, span.end) +
              (span.end < glyphs.length ? (glyphs[span.end - 1]?.hyphen ?? 0) : 0)
        widest = Math.max(widest, indent + lineWidth)
        const h = (runs.length === 0 ? base.size : Math.max(...runs.map((run) => run.size))) * lineScale
        const start =
          ("advance" in span ? paragraph?.sourceOffsetByTextOffset[span.start] : chars[span.start]?.at) ?? paragraphEnd
        const end =
          ("advance" in span ? paragraph?.sourceOffsetByTextOffset[span.end] : chars[span.end]?.at) ?? paragraphEnd
        lines.push({
          start,
          end,
          x: padding.l + indent,
          y,
          w: 0,
          h,
          ink: lineWidth,
          align: alignOf(para),
          runs,
          ...(shaped === undefined
            ? {}
            : { direction: shaped.direction, ...(shaped.locale === undefined ? {} : { locale: shaped.locale }) }),
          ...(shaped?.pending || (shaped === undefined && layout !== undefined && chars.length > 0)
            ? { pending: true }
            : {}),
          ...(spanIndex === 0 &&
          label !== undefined &&
          layout !== undefined &&
          (labelLayout === undefined || labelLayout.pending)
            ? { pending: true }
            : {}),
          ...(spanIndex === 0 && label !== undefined
            ? {
                label: {
                  x: padding.l + level * step,
                  run: { ...labelLook, text: label, ...(labelFace === undefined ? {} : { face: labelFace }) },
                },
              }
            : {}),
        })
        y += h
      }
      if (paragraph !== undefined) probe?.({ ...paragraph, lines: lines.slice(firstLine) })
      y += index === text.paras.length - 1 ? 0 : (para?.spaceAfter ?? 0)
      paragraphStart = paragraphEnd + 1
    }
    const outer = width ?? widest + padding.l + padding.r
    return {
      w: outer,
      h: y + padding.b,
      ...(wordFit === undefined ? {} : { wordFit }),
      lines: lines.map((line) => ({ ...line, w: Math.max(0, outer - padding.r - line.x) })),
    }
  }
}

export function measureWith(widths: FontWidths, probe?: MeasureProbe): Measure {
  return cachedMeasure(measureOnce(widths, probe))
}

export function measureWithLayout(layout: MeasureLayout): Measure {
  return cachedMeasure(measureOnce({}, undefined, layout))
}

function cachedMeasure(measure: Measure): Measure {
  const known = new WeakMap<Text, WeakMap<Theme, Map<Px | null, Measured>>>()
  return (text, theme, width, fit) => {
    if (fit !== undefined) return measure(text, theme, width, fit)
    let themes = known.get(text)
    if (themes === undefined) known.set(text, (themes = new WeakMap()))
    let widthsOf = themes.get(theme)
    if (widthsOf === undefined) themes.set(theme, (widthsOf = new Map()))
    let measured = widthsOf.get(width)
    if (measured === undefined) {
      measured = measure(text, theme, width)
      if (!measured.lines.some((line) => line.pending)) widthsOf.set(width, measured)
    }
    return measured
  }
}
