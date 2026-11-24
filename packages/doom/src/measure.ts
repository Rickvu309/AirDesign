import { graphemes } from "./graphemes.js"
import { type FontWidths, type Glyph, fontFace, isCjk, spansOf, wordBoundary } from "./line-breaks.js"
import { paintedFace } from "./painted-face.js"
import { resolveColor } from "./color.js"
import type { Px } from "./paint.js"
import type { ResolvedLine, ResolvedRun } from "./resolved.js"
import type { Para, Span, Text } from "./text.js"
import { estimateAdvance } from "./text-estimate.js"
import type { Theme } from "./theme.js"

type WordFit = { readonly w: Px; readonly h: Px }
export type Measured = {
  readonly w: Px
  readonly h: Px
  readonly lines: readonly ResolvedLine[]
  readonly wordFit?: WordFit
}
export type Measure = (text: Text, theme: Theme, width: Px | null, fit?: "two-lines") => Measured

const fallbackAdvance = 0.55
const listStep = 1.2
const space = " "

type Look = Omit<ResolvedRun, "text">
type Cased = "upper" | "lower" | "title" | null

type Base = Look & { readonly case: Cased; readonly lineHeight: number; readonly styleWeight: number }

const baseLook = (text: Text, theme: Theme): Base => {
  const style = theme.textStyles[text.style]
  const painted = paintedFace(theme.fonts[style.font], style.weight, undefined)
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

function lookOf(span: Span | undefined, base: Base, theme: Theme): Look & { case: Cased } {
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
      best = Math.min(best, Math.max(ink, total - width - (glyph.join ?? 0)))
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
  }
  return found
}

function measureOnce(widths: FontWidths): Measure {
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
      const glyphs: Glyph[] = []
      let previous: Styled | undefined
      for (const item of chars) {
        const look = looks[item.run]!
        const face = faces[item.run]
        const shown = cased(item.char, look.case, previous?.char)
        const kern =
          previous?.run === item.run
            ? (face?.kerning?.[previous.char.normalize("NFC") + item.char.normalize("NFC")] ?? 0)
            : 0
        const measured = face?.advances[item.char.normalize("NFC")]
        const advance = measured ?? (words ? estimateAdvance(shown) : isCjk(shown) ? 1 : fallbackAdvance)
        glyphs.push({
          char: shown,
          width: (advance + kern) * look.size + look.tracking,
          ...(words && kern !== 0 ? { join: kern * look.size } : {}),
          run: item.run,
        })
        previous = item
      }
      const first = index === 0
      const before = first ? 0 : (para?.spaceBefore ?? 0)
      y += before
      const lineScale = para?.lineHeight ?? base.lineHeight
      if (fit === "two-lines" && text.paras.length === 1 && text.spans.length === 1 && para?.list === undefined) {
        const split = twoLineWidth(glyphs)
        const look = looks[0]
        if (Number.isFinite(split) && look !== undefined)
          wordFit = { w: split + padding.l + padding.r, h: 2 * look.size * lineScale + padding.t + padding.b }
      }
      const paragraphEnd = chars.at(-1)?.end ?? paragraphStart
      for (const [spanIndex, span] of spansOf(glyphs, inner - indent, inner - indent, words).entries()) {
        const runs: ResolvedRun[] = []
        let size = base.size
        for (let at = span.start; at < span.end; at += 1) {
          const glyph = glyphs[at]!
          const look = looks[glyph.run]!
          size = at === span.start ? look.size : Math.max(size, look.size)
          const last = runs[runs.length - 1]
          const { case: _case, ...paint } = look
          if (last !== undefined && looks[glyphs[at - 1]!.run] === look)
            runs[runs.length - 1] = { ...last, text: last.text + glyph.char }
          else runs.push({ ...paint, text: glyph.char })
        }
        const lineWidth = trimmedWidth(glyphs, span.start, span.end)
        widest = Math.max(widest, indent + lineWidth)
        const h = size * lineScale
        const start = chars[span.start]?.at ?? paragraphEnd
        const end = chars[span.end]?.at ?? paragraphEnd
        const { case: _case, lineHeight: _lineHeight, styleWeight: _styleWeight, ...labelLook } = base
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
          ...(spanIndex === 0 && para?.list !== undefined
            ? {
                label: {
                  x: padding.l + level * step,
                  run: { ...labelLook, text: para.list === "bullet" ? "•" : `${String(numbers[level])}.` },
                },
              }
            : {}),
        })
        y += h
      }
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

export function measureWith(widths: FontWidths): Measure {
  const measure = measureOnce(widths)
  const known = new WeakMap<Text, WeakMap<Theme, Map<Px | null, Measured>>>()
  return (text, theme, width, fit) => {
    if (fit !== undefined) return measure(text, theme, width, fit)
    let themes = known.get(text)
    if (themes === undefined) known.set(text, (themes = new WeakMap()))
    let widthsOf = themes.get(theme)
    if (widthsOf === undefined) themes.set(theme, (widthsOf = new Map()))
    let measured = widthsOf.get(width)
    if (measured === undefined) widthsOf.set(width, (measured = measure(text, theme, width)))
    return measured
  }
}
