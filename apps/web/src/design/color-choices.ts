import {
  contrast,
  fadedColor,
  findingLimits,
  opaque,
  sameColor,
  type Color,
  type SchemeName,
} from "@airdesign/document"
import { colorHex } from "@airdesign/pptx"
import { colorCopy } from "@/copy/color-copy"

export type Swatch = { readonly scheme: SchemeName; readonly css: string; readonly name: string }

export type Palette = {
  readonly theme: readonly Swatch[]
  readonly deck: readonly string[]
  readonly behind: string | null
}

export type Choice = { readonly color: Color; readonly css: string; readonly name: string }

export type ThemeColumn = { readonly swatch: Choice; readonly shades: readonly Choice[] }

type Step = { readonly op: "lumMod" | "lumOff"; readonly val: number }

export type Shade = {
  readonly direction: "lighter" | "darker"
  readonly percent: number
  readonly transforms: readonly Step[]
}

export type Hsv = { readonly hue: number; readonly saturation: number; readonly value: number }

const deckRow = 10
const hexDigits = /^#?([0-9A-Fa-f]{6})$/
const usualSlots: Readonly<Record<string, SchemeName>> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2" }

function lighter(percent: number): Shade {
  const kept = (100 - percent) * 1000
  const transforms: Step[] = [
    { op: "lumMod", val: kept },
    { op: "lumOff", val: percent * 1000 },
  ]
  return { direction: "lighter", percent, transforms }
}

function darker(percent: number): Shade {
  return { direction: "darker", percent, transforms: [{ op: "lumMod", val: (100 - percent) * 1000 }] }
}

function channels(hex: string): readonly [number, number, number] {
  return [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255) as unknown as [number, number, number]
}

function lightness(hex: string): number {
  const values = channels(hex)
  return (Math.max(...values) + Math.min(...values)) / 2
}

function bare(css: string): string {
  return hexDigits.exec(css)?.[1]?.toUpperCase() ?? "000000"
}

export function shadesOf(css: string): readonly Shade[] {
  const light = lightness(bare(css))
  if (light === 0) return [50, 35, 25, 15, 5].map(lighter)
  if (light === 1) return [5, 15, 25, 35, 50].map(darker)
  if (light < 0.2) return [90, 75, 50, 25, 10].map(lighter)
  if (light > 0.8) return [10, 25, 50, 75, 90].map(darker)
  return [...[80, 60, 40].map(lighter), ...[25, 50].map(darker)]
}

function shadeName(name: string, shade: Shade): string {
  return shade.direction === "lighter" ? colorCopy.lighter(name, shade.percent) : colorCopy.darker(name, shade.percent)
}

function painted(color: Color, theme: readonly Swatch[]): string {
  return `#${colorHex(color, theme) ?? "000000"}`
}

export function themeColumns(theme: readonly Swatch[]): readonly ThemeColumn[] {
  return theme.map((swatch) => {
    const css = bare(swatch.css)
    const shades = shadesOf(css).map((shade) => {
      const color: Color = { scheme: swatch.scheme, transforms: shade.transforms }
      return { color, css: painted(color, theme), name: shadeName(swatch.name, shade) }
    })
    return { swatch: { color: { scheme: swatch.scheme }, css: `#${css}`, name: swatch.name }, shades }
  })
}

function normalized(color: Color): Color {
  return "scheme" in color ? { ...color, scheme: usualSlots[color.scheme] ?? color.scheme } : color
}

export function matches(choice: Color, value: Color): boolean {
  return sameColor(normalized(choice), normalized(fadedColor(value, opaque)))
}

export function deckChoices(palette: Palette): readonly Choice[] {
  const themed = new Set(palette.theme.map((swatch) => bare(swatch.css)))
  return palette.deck
    .filter((hex) => !themed.has(hex))
    .slice(0, deckRow)
    .map((hex) => ({ color: { rgb: hex }, css: `#${hex}`, name: colorCopy.hexName(hex) }))
}

export function typedColor(text: string): Color | null {
  const hex = hexDigits.exec(text.trim())?.[1]
  return hex === undefined ? null : { rgb: hex.toUpperCase() }
}

export function hexOf({ hue, saturation, value }: Hsv): string {
  const chroma = value * saturation
  const sector = (((hue % 360) + 360) % 360) / 60
  const other = chroma * (1 - Math.abs((sector % 2) - 1))
  const [red, green, blue] =
    sector < 1
      ? [chroma, other, 0]
      : sector < 2
        ? [other, chroma, 0]
        : sector < 3
          ? [0, chroma, other]
          : sector < 4
            ? [0, other, chroma]
            : sector < 5
              ? [other, 0, chroma]
              : [chroma, 0, other]
  const offset = value - chroma
  return [red, green, blue]
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()
}

export function hsvOf(hex: string): Hsv {
  const [red, green, blue] = channels(hex)
  const high = Math.max(red, green, blue)
  const delta = high - Math.min(red, green, blue)
  const sector =
    delta === 0
      ? 0
      : high === red
        ? ((green - blue) / delta + 6) % 6
        : high === green
          ? (blue - red) / delta + 2
          : (red - green) / delta + 4
  return { hue: Math.round(sector * 60), saturation: high === 0 ? 0 : delta / high, value: high }
}

export function shownHex(value: Color, theme: readonly Swatch[]): string {
  return bare(painted(fadedColor(value, opaque), theme))
}

export function shownName(value: Color, theme: readonly Swatch[]): string {
  for (const column of themeColumns(theme)) {
    for (const choice of [column.swatch, ...column.shades]) if (matches(choice.color, value)) return choice.name
  }
  const named = theme.find((swatch) => "scheme" in value && swatch.scheme === value.scheme && !value.transforms)
  if (named !== undefined) return named.name
  return colorCopy.hexName(shownHex(value, theme))
}

export function contrastOf(
  value: Color,
  behind: string | null,
  theme: readonly Swatch[],
): { readonly ratio: number; readonly passes: boolean } | null {
  if (behind === null) return null
  const ratio = Math.floor(contrast(shownHex(value, theme), behind) * 100) / 100
  return { ratio, passes: ratio >= findingLimits.contrast }
}
