import { resolveColor } from "../color.js"
import type { Color, Hex } from "../paint.js"
import type { Theme } from "../theme.js"
import { finite } from "../read-kit.js"
import { type Charge, type Values, color } from "./values.js"

function luminance(hex: string): number {
  const linear = (start: number) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5)
}

export function readableInk([fill]: Values, theme: Theme): Color {
  const level = luminance(resolveColor(color(fill), theme))
  const black = (level + 0.05) / 0.05
  const white = 1.05 / (level + 0.05)
  return black >= white ? { var: "text", tint: -1 } : { var: "background", tint: 1 }
}

export function contrastTint([fill, backdrop, minimum]: Values, theme: Theme, charge: Charge): Color {
  const original = color(fill)
  const source = resolveColor(original, theme)
  const background = resolveColor(color(backdrop), theme)
  const target = finite(1, 21)(minimum)
  const level = luminance(background)
  const contrast = (hex: Hex) => {
    const other = luminance(hex)
    return (Math.max(level, other) + 0.05) / (Math.min(level, other) + 0.05)
  }
  if (contrast(source) <= target) return original

  const mix = (share: number): Hex =>
    `#${[1, 3, 5]
      .map((start) => {
        const from = Number.parseInt(source.slice(start, start + 2), 16)
        const to = Number.parseInt(background.slice(start, start + 2), 16)
        return Math.round(from + (to - from) * share)
          .toString(16)
          .padStart(2, "0")
      })
      .join("")}`

  let low = 0
  let high = 1
  for (let i = 0; i < 10; i++) {
    charge()
    const middle = (low + high) / 2
    if (contrast(mix(middle)) >= target) low = middle
    else high = middle
  }
  return mix(low)
}
