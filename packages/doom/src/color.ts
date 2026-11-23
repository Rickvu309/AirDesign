import { type Color, type Hex, readColor as colorReader } from "./paint.js"
import { rejected } from "./read-kit.js"
import type { Theme } from "./theme.js"

const channels = (hex: Hex): readonly number[] => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))

const hexOf = (parts: readonly number[]): Hex =>
  `#${parts
    .map((part) =>
      Math.round(Math.max(0, Math.min(255, part)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`

export function tinted(hex: Hex, tint: number): Hex {
  const towards = tint > 0 ? 255 : 0
  const share = Math.abs(tint)
  return hexOf(channels(hex).map((part) => part + (towards - part) * share))
}

export function resolveColor(color: Color, theme: Theme): Hex {
  if (typeof color === "string") return color
  const base = theme.colors[color.var]
  return color.tint === undefined || color.tint === 0 ? base : tinted(base, color.tint)
}

export function readColor(raw: unknown): Color | undefined {
  try {
    return colorReader(raw)
  } catch (thrown) {
    rejected(thrown)
    return undefined
  }
}

export function sameColor(left: Color, right: Color): boolean {
  if (typeof left === "string" || typeof right === "string")
    return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase()
  return left.var === right.var && (left.tint ?? 0) === (right.tint ?? 0)
}
