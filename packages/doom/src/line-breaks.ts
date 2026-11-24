const tolerance = 1e-6
const subpixel = 1 / 64
const forced = "\n"
const space = " "

export type FontFace = {
  readonly ascent: number
  readonly descent: number
  readonly advances: Readonly<Record<string, number>>
  readonly kerning?: Readonly<Record<string, number>>
}

export type FontWidths = Readonly<Record<string, FontFace>>

export type Glyph = { readonly char: string; readonly width: number; readonly run: number; readonly join?: number }
export type LineSpan = { readonly start: number; readonly end: number; readonly forced: boolean }

export function fontFace(font: string, bold: boolean, italic: boolean): string {
  return [font, ...(bold ? ["bold"] : []), ...(italic ? ["italic"] : [])].join("|")
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

export function isCjk(char: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char)
}

export function wordBoundary(char: string, next: string): boolean {
  return char === space ? next !== space : isCjk(char) && isCjk(next)
}

export function spansOf(glyphs: readonly Glyph[], first: number, rest: number, words: boolean): readonly LineSpan[] {
  const slack = words ? subpixel : tolerance
  const chars = glyphs.map((glyph) => glyph.char)
  const spans: LineSpan[] = []
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
    while (to < glyphs.length - 1) {
      if (words ? wordBoundary(chars[to]!, chars[to + 1]!) : breaksAfter(chars, to)) break
      to += 1
    }
    let full = 0
    let tail = 0
    for (let at = from; at <= to; at += 1) {
      const glyph = glyphs[at]
      if (glyph === undefined) continue
      full += glyph.width
      tail = glyph.char === space || glyph.char === forced ? tail + glyph.width : 0
    }
    const content = full - tail
    if (has && width + content > room + slack) close(from, false)
    if (!words && !has && content > room + tolerance) {
      for (let at = from; at <= to; at += 1) {
        const glyph = glyphs[at]
        if (glyph === undefined) continue
        const blank = glyph.char === space || glyph.char === forced
        if (has && !blank && width + glyph.width > room + tolerance) close(at, false)
        width += glyph.width
        has = true
      }
    } else {
      width += full - (has ? 0 : (glyphs[from]?.join ?? 0))
      has = true
    }
    if (chars[to] === forced) close(to + 1, true)
    from = to + 1
  }
  if (has || spans.length === 0) spans.push({ start, end: glyphs.length, forced: false })
  return spans
}
