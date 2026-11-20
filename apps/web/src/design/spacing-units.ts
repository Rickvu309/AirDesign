import { singleLineHeight } from "@airdesign/render"
import type { TypedUnit } from "./typed-number"

const defaultSize = 1800

export function spacingUnits(
  trait: string,
  field: string,
  size: unknown,
): { readonly numberScale?: number; readonly typed?: TypedUnit } {
  if (trait !== "text") return {}
  const points = (typeof size === "number" ? size : defaultSize) / 100
  if (field === "letterSpacing") return { numberScale: points / 100, typed: { points: 100 / points } }
  if (field === "lineHeight") return { typed: { auto: 100, points: 100 / (singleLineHeight * points), fixed: true } }
  return {}
}
