import { type Color, type Hex, colorVars, readColor as colorReader } from "./paint.js"
import { Reject } from "./read-kit.js"
import type { Theme } from "./theme.js"

export type Rgb = readonly [number, number, number]

export function channels(hex: Hex): Rgb {
  const at = (index: number) => Number.parseInt(hex.slice(index, index + 2), 16)
  return [at(1), at(3), at(5)]
}

export const over = (front: Rgb, alpha: number, back: Rgb): Rgb => [
  back[0] + (front[0] - back[0]) * alpha,
  back[1] + (front[1] - back[1]) * alpha,
  back[2] + (front[2] - back[2]) * alpha,
]

const linear = (part: number) => {
  const share = part / 255
  return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

export function contrastRatio(one: Rgb, other: Rgb): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((a, b) => b - a)
  return (light! + 0.05) / (dark! + 0.05)
}

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
    if (!(thrown instanceof Reject)) throw thrown
    return undefined
  }
}

export function namedColor(raw: string): Color | undefined {
  const [, name, step] = /^([a-z0-9]+)([+-](?:100|[1-9][0-9]?))?$/.exec(raw) ?? []
  const base = colorVars.find((entry) => entry === name)
  if (base === undefined) return undefined
  return step === undefined ? { var: base } : { var: base, tint: Number(step) / 100 }
}

export function sameColor(left: Color, right: Color): boolean {
  if (typeof left === "string" || typeof right === "string")
    return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase()
  return left.var === right.var && (left.tint ?? 0) === (right.tint ?? 0)
}
