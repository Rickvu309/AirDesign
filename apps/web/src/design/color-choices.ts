import * as doom from "@airdesign/doom"
import { colorCopy } from "@/copy/color-copy"

export type Swatch = { readonly var: doom.ColorVar; readonly css: string; readonly name: string }

export type Palette = {
  readonly templateColors: readonly Swatch[]
  readonly deck: readonly string[]
}

export type Choice = { readonly color: doom.Color; readonly css: string; readonly name: string }

export type TemplateColorColumn = { readonly swatch: Choice; readonly shades: readonly Choice[] }

export type Shade = { readonly direction: "lighter" | "darker"; readonly percent: number }

export type Hsv = { readonly hue: number; readonly saturation: number; readonly value: number }

const hexDigits = /^#?([0-9A-Fa-f]{6})$/

const lighter = (percent: number): Shade => ({ direction: "lighter", percent })

const darker = (percent: number): Shade => ({ direction: "darker", percent })

const tintOf = (shade: Shade): number => (shade.direction === "lighter" ? shade.percent : -shade.percent) / 100

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

export function shownHex(value: doom.Color, templateColors: readonly Swatch[]): string {
  if (typeof value === "string") return bare(value)
  const css = templateColors.find((swatch) => swatch.var === value.var)?.css
  if (css === undefined) return "000000"
  const base: doom.Hex = `#${bare(css).toLowerCase()}`
  return bare(value.tint === undefined || value.tint === 0 ? base : doom.tinted(base, value.tint))
}

export function pickerSwatches(templateColors: readonly Swatch[]): readonly Swatch[] {
  return templateColors.filter((swatch) => doom.paletteColorVars.some((role) => role === swatch.var))
}

export function templateColorColumns(templateColors: readonly Swatch[]): readonly TemplateColorColumn[] {
  return templateColors.map((swatch) => {
    const shades = shadesOf(swatch.css).map((shade) => {
      const color: doom.Color = { var: swatch.var, tint: tintOf(shade) }
      return { color, css: `#${shownHex(color, templateColors)}`, name: shadeName(swatch.name, shade) }
    })
    return { swatch: { color: { var: swatch.var }, css: `#${bare(swatch.css)}`, name: swatch.name }, shades }
  })
}

export const matches = (choice: doom.Color, value: doom.Color): boolean => doom.sameColor(choice, value)

export function deckChoices(palette: Palette): readonly Choice[] {
  const taken = new Set(pickerSwatches(palette.templateColors).map((swatch) => bare(swatch.css)))
  return palette.deck
    .filter((hex) => !taken.has(hex))
    .map((hex) => ({ color: `#${hex.toLowerCase()}`, css: `#${hex}`, name: hex }))
}

export function tintChoices(templateColors: readonly Swatch[], value: doom.Color | undefined): readonly Choice[] {
  const shades = templateColorColumns(pickerSwatches(templateColors)).flatMap((column) => column.shades)
  if (value === undefined || typeof value === "string" || value.tint === undefined || value.tint === 0) return shades
  if (shades.some((choice) => matches(choice.color, value))) return shades
  const hex = shownHex(value, templateColors)
  return [{ color: value, css: `#${hex}`, name: hex }, ...shades]
}

export function typedColor(text: string): doom.Hex | null {
  const hex = hexDigits.exec(text.trim())?.[1]
  return hex === undefined ? null : `#${hex.toLowerCase()}`
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

export function shownName(value: doom.Color, templateColors: readonly Swatch[]): string {
  if (typeof value !== "string" && (value.tint === undefined || value.tint === 0)) {
    const named = templateColors.find((swatch) => swatch.var === value.var)
    if (named !== undefined) return named.name
  }
  return shownHex(value, templateColors)
}
