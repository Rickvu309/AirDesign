import { boldWeight, regularWeight, type FontStyle } from "./named-face.js"

export const plainStyles: readonly FontStyle[] = [regularWeight, boldWeight].flatMap((weight) => [
  { weight, italic: false },
  { weight, italic: true },
])

export function steppedWeight(current: FontStyle, styles: readonly FontStyle[], step: 1 | -1): FontStyle | null {
  const slanted = styles.filter((style) => style.italic === current.italic)
  const next =
    step > 0
      ? slanted.find((style) => style.weight > current.weight)
      : slanted.findLast((style) => style.weight < current.weight)
  return next ?? null
}
