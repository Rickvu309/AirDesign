import { type FontWidths, type Glyph, fontFace, spansOf } from "../text-fit.js"
import { resolveColor } from "./color.js"
import type { Px } from "./paint.js"
import type { ResolvedLine, ResolvedRun } from "./resolved.js"
import type { Para, Span, Text } from "./text.js"
import type { Theme } from "./theme.js"

export type Measured = { readonly w: Px; readonly h: Px; readonly lines: readonly ResolvedLine[] }
export type Measure = (text: Text, theme: Theme, width: Px | null) => Measured

const fallbackAdvance = 0.55
const boldFrom = 600
const listStep = 1.2
const space = " "

type Look = Omit<ResolvedRun, "text">
type Cased = "upper" | "lower" | "title" | null

const baseLook = (text: Text, theme: Theme): Look & { readonly case: Cased; readonly lineHeight: number } => {
  const style = theme.textStyles[text.style]
  return {
    size: style.size,
    font: theme.fonts[style.font],
    bold: style.weight >= boldFrom,
    italic: false,
    underline: false,
    strike: false,
    color: theme.colors.text,
    tracking: style.tracking,
    case: style.case ?? null,
    lineHeight: style.lineHeight,
  }
}

function lookOf(span: Span | undefined, base: ReturnType<typeof baseLook>, theme: Theme): Look & { case: Cased } {
  const { lineHeight: _lineHeight, ...look } = base
  if (span === undefined) return look
  return {
    ...look,
    ...(span.bold === undefined ? {} : { bold: span.bold }),
    ...(span.italic === undefined ? {} : { italic: span.italic }),
    ...(span.underline === undefined ? {} : { underline: span.underline }),
    ...(span.strike === undefined ? {} : { strike: span.strike }),
    ...(span.size === undefined ? {} : { size: span.size }),
    ...(span.font === undefined ? {} : { font: span.font }),
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
  return [...turned].length === 1 ? turned : char
}

type Styled = { readonly char: string; readonly at: number; readonly run: number }

function styledChars(text: Text): readonly (Styled | "break")[] {
  const out: (Styled | "break")[] = []
  let run = 0
  let at = 0
  for (const char of text.chars) {
    while (text.spans[run] !== undefined && at >= text.spans[run]!.end) run += 1
    out.push(char === "\n" ? "break" : { char, at, run })
    at += char.length
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
  return width - tail
}

const alignOf = (para: Para | undefined) => para?.align ?? "left"

export function measureWith(widths: FontWidths): Measure {
  return (text, theme, width) => {
    const base = baseLook(text, theme)
    const padding = text.padding ?? { t: 0, r: 0, b: 0, l: 0 }
    const looks = (text.spans.length === 0 ? [undefined] : text.spans).map((span) => lookOf(span, base, theme))
    const faces = looks.map((look) => widths[fontFace(look.font, look.bold, look.italic)])
    const inner = width === null ? Number.POSITIVE_INFINITY : Math.max(0, width - padding.l - padding.r)
    const lines: ResolvedLine[] = []
    const numbers: number[] = []
    let y = padding.t
    let widest = 0
    let paragraphStart = 0
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
        const kern = previous?.run === item.run ? (face?.kerning?.[previous.char + item.char] ?? 0) : 0
        glyphs.push({
          char: shown,
          width: ((face?.advances[item.char] ?? fallbackAdvance) + kern) * look.size + look.tracking,
          run: item.run,
        })
        previous = item
      }
      const first = index === 0
      const before = first ? 0 : (para?.spaceBefore ?? 0)
      y += before
      const lineScale = para?.lineHeight ?? base.lineHeight
      const paragraphEnd = paragraphStart + chars.reduce((sum, item) => sum + item.char.length, 0)
      for (const [spanIndex, span] of spansOf(glyphs, inner - indent, inner - indent).entries()) {
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
        const { case: _case, lineHeight: _lineHeight, ...labelLook } = base
        lines.push({
          start,
          end,
          x: padding.l + indent,
          y,
          w: 0,
          h,
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
      lines: lines.map((line) => ({ ...line, w: Math.max(0, outer - padding.r - line.x) })),
    }
  }
}
