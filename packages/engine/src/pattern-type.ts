import type { Color, Palette, SlideSize, TextParagraph, TextRun } from "@airdesign/document"

const point = 12_700

export type Role = "number" | "heading" | "body" | "caption" | "label"

export type TypeScale = Readonly<Record<Role, number>> & {
  readonly gap: number
  readonly pad: number
  readonly font: { readonly heading?: string; readonly body?: string }
}

const sizes: Readonly<Record<Role, number>> = { number: 36, heading: 16, body: 12, caption: 11, label: 10 }

export const typeSteps = [1, 0.9, 0.8, 0.7] as const

export function typeScale(size: SlideSize, palette: Palette | undefined, step: number = 1): TypeScale {
  const unit = (size.height / point / 540) * step
  const scaled = (role: Role) => Math.max(800, Math.round(sizes[role] * unit) * 100)
  const fonts = palette?.fonts ?? {}
  return {
    number: scaled("number"),
    heading: scaled("heading"),
    body: scaled("body"),
    caption: scaled("caption"),
    label: scaled("label"),
    gap: Math.round(size.width * 0.015),
    pad: Math.round(size.width * 0.02),
    font: {
      ...(fonts.major === undefined ? {} : { heading: fonts.major }),
      ...(fonts.minor === undefined ? {} : { body: fonts.minor }),
    },
  }
}

const scheme = (name: string): Color => ({ scheme: name }) as Color

export const tones = {
  ink: scheme("tx1"),
  quiet: scheme("tx2"),
  paper: scheme("lt1"),
  card: scheme("lt2"),
  accent: scheme("accent1"),
} as const

export type Line = {
  readonly text: string
  readonly role: Role
  readonly color?: Color
  readonly bullet?: boolean
  readonly upper?: boolean
  readonly center?: boolean
  readonly size?: number
}

function runOf(line: Line, scale: TypeScale): TextRun {
  const strong = line.role === "number" || line.role === "heading"
  const font = strong ? scale.font.heading : scale.font.body
  return {
    from: -1,
    text: line.text,
    size: line.size ?? scale[line.role],
    color: line.color ?? (line.role === "caption" || line.role === "label" ? tones.quiet : tones.ink),
    ...(font === undefined ? {} : { font }),
    ...(strong ? { bold: true } : {}),
    ...(line.upper === true ? { case: "upper", letterSpacing: 60 } : {}),
  }
}

export function paragraphsOf(lines: readonly Line[], scale: TypeScale): readonly TextParagraph[] {
  return lines.map((line) => ({
    from: 0,
    align: line.center === true ? "center" : "left",
    ...(line.bullet === true ? { list: "bullets", spaceAfter: Math.round(scale.body * 0.35) } : {}),
    runs: [runOf(line, scale)],
  }))
}

export function fittedSize(texts: readonly string[], width: number, most: number, least: number): number {
  const longest = Math.max(1, ...texts.map((text) => text.length))
  const fits = Math.floor(width / (longest * 0.62 * point)) * 100
  return Math.max(least, Math.min(most, fits))
}

const letterWidths: readonly (readonly [RegExp, number])[] = [
  [/[ijl.,:;'!|]/, 0.24],
  [/[ft \-()[\]r/]/, 0.31],
  [/[mw]/, 0.83],
  [/[MW%]/, 0.9],
  [/[A-Z]/, 0.7],
  [/[0-9$a-z]/, 0.55],
]

function wordWidth(word: string, upper: boolean): number {
  let total = 0
  for (const letter of upper ? word.toUpperCase() : word)
    total += letterWidths.find(([kind]) => kind.test(letter))?.[1] ?? 0.9
  return total
}

function wrappedLines(text: string, room: number, upper: boolean): number {
  const space = wordWidth(" ", upper)
  let lines = 1
  let used = 0
  for (const word of text.split(/\s+/).filter((each) => each.length > 0)) {
    const wide = wordWidth(word, upper)
    const wanted = used === 0 ? wide : used + space + wide
    if (wanted <= room) {
      used = wanted
      continue
    }
    if (used > 0) lines += 1
    lines += Math.floor(Math.max(0, wide - 0.001) / room)
    used = wide % room || room
  }
  return lines
}

export function linesHigh(lines: readonly Line[], scale: TypeScale, width: number): number {
  return lines.reduce((total, line) => {
    const size = (line.size ?? scale[line.role]) / 100
    const room = Math.max(1, width - (line.bullet === true ? size * 1.9 * point : 0))
    const strong = line.role === "number" || line.role === "heading"
    const em = size * point * (strong ? 1.07 : 1) + (line.upper === true ? 0.6 * point : 0)
    const count = wrappedLines(line.text, room / em, line.upper === true)
    const after = line.bullet === true ? (scale.body * 0.35 * point) / 100 : 0
    return total + count * size * 1.22 * point + after
  }, 0)
}
