import { namesAlpha, colorPaint, type Color, type TextFill } from "@airdesign/document"
import type { CSSProperties } from "react"
import type { CanvasRunStyle, CanvasTemplateColor } from "./text-record.js"

function cssHex(color: string | null): string | null {
  if (color === null) return null
  const hex = /^#([\da-f]{6})(?:[\da-f]{2})?$/i.exec(color)?.[1]
  if (hex !== undefined) return hex.toUpperCase()
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color)
  if (rgb === null) return null
  return [rgb[1], rgb[2], rgb[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
}

export function schemeOf(style: CanvasRunStyle, colors: readonly CanvasTemplateColor[]): Color | null {
  const hex = cssHex(style.color)
  if (hex === null) return null
  const matches = colors.filter((swatch) => cssHex(swatch.css) === hex)
  const found = matches.length === 1 ? matches[0] : undefined
  return found === undefined ? null : { scheme: found.scheme }
}

export function paintedColor(color: Color, colors: readonly CanvasTemplateColor[], file: string | null): string | null {
  const slot = (scheme: string) => cssHex(colors.find((swatch) => swatch.scheme === scheme)?.css ?? null)
  const hex = colorPaint(
    { ...color, transforms: (color.transforms ?? []).filter(({ op }) => !op.startsWith("alpha")) },
    slot,
  )?.hex
  if (hex === undefined) return file
  const css = `#${hex}`
  const alpha = file === null ? undefined : /^#[\da-f]{6}([\da-f]{2})$/i.exec(file)?.[1]
  return alpha === undefined || !/^#[\da-f]{6}$/i.test(css) ? css : `${css}${alpha}`
}

export function gradientLook(fill: TextFill | undefined, colors: readonly CanvasTemplateColor[]): CSSProperties {
  if (fill === undefined || !("gradient" in fill)) return {}
  const gradient = fill.gradient
  const css = (color: Color) => {
    const painted = colorPaint(color, (scheme) =>
      cssHex(colors.find((swatch) => swatch.scheme === scheme)?.css ?? null),
    )
    if (painted === null) return "black"
    const alpha =
      painted.alpha >= 1
        ? ""
        : Math.round(painted.alpha * 255)
            .toString(16)
            .padStart(2, "0")
    return `#${painted.hex}${alpha}`
  }
  const stops = gradient.stops.map((stop) => `${css(stop.color)} ${stop.pos / 1000}%`).join(", ")
  const backgroundImage =
    "linear" in gradient.shade
      ? `linear-gradient(${gradient.shade.linear.angle / 60000 + 90}deg, ${stops})`
      : `radial-gradient(${stops})`
  return { backgroundImage, backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }
}

export function keptTextFill(fill: TextFill, source: string | null): TextFill {
  if (!("gradient" in fill) || namesAlpha(fill.gradient.stops.map((stop) => stop.color))) return fill
  const alpha = source === null ? undefined : /^#[\da-f]{6}([\da-f]{2})$/i.exec(source)?.[1]
  if (alpha === undefined) return fill
  const val = Math.round((Number.parseInt(alpha, 16) / 255) * 100000)
  return {
    gradient: {
      ...fill.gradient,
      stops: fill.gradient.stops.map((stop) => ({
        ...stop,
        color: { ...stop.color, transforms: [...(stop.color.transforms ?? []), { op: "alpha", val }] },
      })),
    },
  }
}
