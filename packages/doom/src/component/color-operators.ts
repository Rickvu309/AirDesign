import { type Color, type Theme, resolveColor } from "../index.js"
import { type Values, color } from "./values.js"

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
