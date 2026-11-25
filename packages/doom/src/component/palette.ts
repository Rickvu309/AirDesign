import { resolveColor, tinted } from "../color.js"
import type { Color } from "../paint.js"
import { reject } from "../read-kit.js"
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

export function palette(paints: Values, requested: Values, theme: Theme, charge: Charge): Color[] {
  const bases = uniqueColors(paints, theme, charge)
  if (bases.length === 0) return reject("shape", "A palette needs at least one colour.")
  const used = new Set(requested.flatMap((raw) => (raw === null ? [] : [hex(color(raw), theme)])))
  const candidates = colors(bases, theme)
  return requested.map((raw) => {
    if (raw !== null) return color(raw)
    for (let next = candidates.next(); !next.done; next = candidates.next()) {
      const paint = next.value
      charge()
      const key = hex(paint, theme)
      if (used.has(key)) continue
      used.add(key)
      return paint
    }
    return reject("limit", "The palette ran out of distinct colours.")
  })
}

function* colors(bases: readonly Color[], theme: Theme): Generator<Color> {
  yield* bases
  for (let step = 1; step < 256; step += 1) {
    const amount = ((step * 97) % 256) / 256
    for (const tint of [amount, -amount]) {
      for (const paint of bases) {
        yield typeof paint === "string" || paint.tint
          ? tinted(resolveColor(paint, theme), tint)
          : { var: paint.var, tint }
      }
    }
  }
}
