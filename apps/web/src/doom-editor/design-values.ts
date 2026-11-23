import * as doom from "@airdesign/doom"
import type { PanelGradient, PanelPaint } from "@/design/panel"

export const pointEmu = 12_700
export const cornerEmu = 9_525
export const hundredths = 100
export const wholeFraction = 100_000
export const degreeAngle = 60_000

const wholeCircle = 21_600_000
const middle = 50_000

export function emuOf(px: number): number {
  return Math.round(px * pointEmu)
}

export function pxOf(emu: number): number {
  return emu / pointEmu
}

export function panelPaintOf(paint: doom.Paint): PanelPaint {
  if (paint.kind === "solid") return { solid: paint.color }
  if (paint.kind === "image") return { image: paint.asset }
  const stops = paint.stops.map((stop) => ({ pos: Math.round(stop.at * wholeFraction), color: stop.color }))
  const shade =
    paint.shape === "radial"
      ? { path: { kind: "circle" as const, focus: { l: middle, t: middle, r: middle, b: middle } } }
      : {
          linear: {
            angle: ((Math.round(paint.angle * degreeAngle) % wholeCircle) + wholeCircle) % wholeCircle,
            scaled: false,
          },
        }
  return { gradient: { stops, shade, rotateWithShape: true } }
}

export function doomPaintOf(value: unknown, kept: doom.Paint | undefined): doom.Paint | null {
  if (typeof value !== "object" || value === null) return null
  const extra = {
    ...(kept?.opacity === undefined ? {} : { opacity: kept.opacity }),
  }
  if ("solid" in value) {
    const color = doom.readColor(value.solid)
    return color === undefined ? null : { kind: "solid", color, ...extra }
  }
  if ("gradient" in value) {
    const gradient = value.gradient as PanelGradient
    const stops = gradient.stops.flatMap((stop) => {
      const color = doom.readColor(stop.color)
      return color === undefined ? [] : [{ at: Math.min(1, Math.max(0, stop.pos / wholeFraction)), color }]
    })
    if (stops.length < 2) return null
    const radial = "path" in gradient.shade
    const angle = "linear" in gradient.shade ? Math.round(gradient.shade.linear.angle / degreeAngle) : 0
    return { kind: "gradient", shape: radial ? "radial" : "linear", angle, stops, ...extra }
  }
  if ("image" in value && typeof value.image === "string")
    return kept?.kind === "image" && kept.asset === value.image
      ? kept
      : { kind: "image", asset: value.image, fit: "fill", ...extra }
  return null
}
