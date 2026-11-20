import { colorPaint, hexRgb, type Color, type Palette, type Rgb } from "@airdesign/document"

export type ChartInkSlot = "bg1" | "tx1"
export type ChartInk = (fill: Color) => ChartInkSlot

const usualMap: Readonly<Record<string, string>> = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" }

const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

function luminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map(linear)
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

function contrast(left: number, right: number): number {
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05)
}

export function chartInk(palette: Palette | null): ChartInk {
  if (palette === null) return () => "tx1"
  const mapped = palette.map as Readonly<Record<string, string | undefined>>
  const slots = palette.slots as Readonly<Record<string, string | undefined>>
  const slot = (scheme: string) => slots[mapped[scheme] ?? usualMap[scheme] ?? scheme] ?? null
  const lit = (color: Color) => {
    const painted = colorPaint(color, slot)
    const rgb = painted === null ? null : hexRgb(painted.hex)
    return rgb === null ? null : luminance(rgb)
  }
  const background = lit({ scheme: "bg1" })
  const text = lit({ scheme: "tx1" })
  return (fill) => {
    const shown = lit(fill)
    if (shown === null || background === null || text === null) return "tx1"
    return contrast(shown, background) > contrast(shown, text) ? "bg1" : "tx1"
  }
}
