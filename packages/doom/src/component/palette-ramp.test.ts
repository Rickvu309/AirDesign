import { expect, it, vi } from "vitest"
import { resolveColor } from "../color.js"
import type { Hex } from "../paint.js"
import { defaultTheme, themeLibrary } from "../theme.js"
import { paletteRamp, rampLightness } from "./palette-ramp.js"

function luminance(hex: Hex) {
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) => {
    const offset = 1 + channel * 2
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    return sum + weight * linear
  }, 0)
}

function contrast(left: Hex, right: Hex) {
  const a = luminance(left)
  const b = luminance(right)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

it.each(Object.entries(themeLibrary))("keeps the accent and neutral marks visible in %s", (_id, { theme }) => {
  const { accent1, background } = theme.colors
  const colorAt = (i: number, size: number) => {
    const role = paletteRamp([i, size, { var: "accent1" }, { var: "text2" }], theme)
    expect(role).toMatchObject({ var: i === 0 ? "accent1" : "text2" })
    return resolveColor(role, theme)
  }
  const ramp = Array.from({ length: 6 }, (_, i) => colorAt(i, 6))
  const neutral = colorAt(1, 2)
  expect(ramp[0]).toBe(accent1)
  expect(new Set(ramp).size).toBe(3)
  expect(contrast(neutral, background)).toBeGreaterThanOrEqual(3)
  expect(contrast(neutral, background)).toBeLessThan(3.05)
  expect(contrast(neutral, background)).toBeLessThan(contrast(accent1, background))
  expect(Math.abs(rampLightness(ramp[2]!) - rampLightness(ramp[1]!))).toBeGreaterThanOrEqual(0.06)
  expect(ramp.slice(3)).toEqual([ramp[1], ramp[2], ramp[1]])
})

it.each(Object.entries(themeLibrary))("mutes labelled highlights in %s", (_id, { theme }) => {
  const { accent1, background } = theme.colors
  const grey = resolveColor(paletteRamp([1, 2, { var: "accent1" }, { var: "text2" }, true], theme), theme)
  expect(contrast(grey, background)).toBeGreaterThanOrEqual(2.2)
  expect(contrast(grey, background)).toBeLessThan(2.25)
  expect(contrast(grey, accent1)).toBeGreaterThanOrEqual(2)
})

it("reports when the palette needs more distinct colours than it has slots", () => {
  const report = vi.fn()
  const theme = defaultTheme
  paletteRamp([0, 5, { var: "accent1" }, { var: "text2" }, true], theme, report)
  expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "many-series", count: 5, capacity: 3 })
})
