import type { StrokeStyle } from "@airdesign/doom"

const dashes = { solid: [], dash: [3, 2], dot: [0.01, 2] } as const

export function strokeDash({ dash, weight }: StrokeStyle): number[] {
  return dashes[dash].map((step) => step * weight)
}
