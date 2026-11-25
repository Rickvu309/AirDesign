import { resolveColor } from "../color.js"
import type { Color } from "../paint.js"
import type { Theme } from "../theme.js"
import { color, type Charge, type Values } from "./values.js"

const hex = (paint: Color, theme: Theme) => resolveColor(paint, theme).toLowerCase()

export function uniqueColors(paints: Values, theme: Theme, charge: Charge): Color[] {
  const seen = new Set<string>()
  return paints.flatMap((raw) => {
    charge()
    const paint = color(raw)
    const key = hex(paint, theme)
    if (seen.has(key)) return []
    seen.add(key)
    return [paint]
  })
}
