import type { Color, SlideSize, TextParagraph, TextRun, TextStyle } from "@airdesign/document"

const point = 12_700

export type Role = "number" | "heading" | "body" | "caption" | "label"

type RoleLook = {
  readonly font: string
  readonly bold: boolean
  readonly color?: Color
  readonly letterSpacing?: number
}

export type TypeScale = Readonly<Record<Role, number>> & {
  readonly gap: number
  readonly pad: number
  readonly looks: Readonly<Record<Role, RoleLook>>
}

const roles: readonly Role[] = ["number", "heading", "body", "caption", "label"]
const sizes: Readonly<Record<Role, number>> = { number: 36, heading: 16, body: 12, caption: 11, label: 10 }
const styleNames: Readonly<Record<Role, readonly string[]>> = {
  number: ["Big number"],
  heading: ["Heading"],
  body: ["Body", "Body 1"],
  caption: ["Caption"],
  label: ["Label"],
}

export const typeSteps = [1, 0.9, 0.8, 0.7] as const

function namedStyle(styles: readonly TextStyle[], role: Role): TextStyle | undefined {
  return styleNames[role]
    .map((name) => styles.find((style) => style.name === name))
    .find((style) => style !== undefined)
}

export function typeScale(size: SlideSize, styles: readonly TextStyle[], step: number = 1): TypeScale {
  const unit = (size.height / point / 540) * step
  const entries = roles.map((role) => {
    const style = namedStyle(styles, role)?.fields
    const strong = role === "number" || role === "heading"
    const wanted = style?.size === undefined ? Math.round(sizes[role] * unit) * 100 : Math.round(style.size * step)
    const look: RoleLook = {
      font: style?.font ?? (strong ? "+mj-lt" : "+mn-lt"),
      bold: style?.bold ?? strong,
      ...(style?.color === undefined ? {} : { color: style.color }),
      ...(style?.letterSpacing === undefined || style.letterSpacing === 0
        ? {}
        : { letterSpacing: style.letterSpacing }),
    }
    return [role, Math.max(800, wanted), look] as const
  })
  const sized = Object.fromEntries(entries.map(([role, value]) => [role, value])) as Record<Role, number>
  const looks = Object.fromEntries(entries.map(([role, , look]) => [role, look])) as Record<Role, RoleLook>
  return { ...sized, gap: Math.round(size.width * 0.015), pad: Math.round(size.width * 0.02), looks }
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
  const look = scale.looks[line.role]
  const quiet = line.role === "caption" || line.role === "label" ? tones.quiet : tones.ink
  const spacing = look.letterSpacing ?? (line.upper === true ? 60 : undefined)
  return {
    from: -1,
    text: line.text,
    size: line.size ?? scale[line.role],
    color: line.color ?? look.color ?? quiet,
    font: look.font,
    ...(look.bold ? { bold: true } : {}),
    ...(line.upper === true ? { case: "upper" } : {}),
    ...(spacing === undefined ? {} : { letterSpacing: spacing }),
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
    const room = Math.max(1, width - (line.bullet === true ? size * 0.9 * point : 0))
    const look = scale.looks[line.role]
    const spacing = (look.letterSpacing ?? (line.upper === true ? 60 : 0)) / 100
    const em = size * point * (look.bold ? 1.07 : 1) + spacing * point
    const count = wrappedLines(line.text, room / em, line.upper === true)
    const after = line.bullet === true ? (scale.body * 0.35 * point) / 100 : 0
    return total + count * size * 1.22 * point + after
  }, 0)
}
