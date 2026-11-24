import { expect, it } from "vitest"
import type { Desc } from "./control-desc"
import { clampedOf, shownInUnit, storedOf, typedNumber } from "./typed-number"

it("reads a typed value with or without its unit, as Figma's fields do", () => {
  expect(typedNumber("150")).toBe(150)
  expect(typedNumber(" 150 % ")).toBe(150)
  expect(typedNumber("1,5%")).toBe(1.5)
  expect(typedNumber("-2%")).toBe(-2)
  expect(typedNumber("wide")).toBeNull()
  expect(typedNumber("")).toBeNull()
})

it("stores a typed length in points, a type size in points and a fraction in percent", () => {
  const length: Desc = { kind: "number", unit: "emu", min: -27_273_042_329_600, max: 27_273_042_316_900 }
  const typeSize: Desc = { kind: "number", unit: "hundredth-point", min: 100, max: 400_000 }
  const fraction: Desc = { kind: "number", unit: "fraction", min: 0, max: 100_000 }
  expect(storedOf(length, 72)).toBe(914_400)
  expect(storedOf(length, -36.5)).toBe(-463_550)
  expect(storedOf(typeSize, 10.5)).toBe(1_050)
  expect(storedOf(fraction, 80)).toBe(80_000)
  expect(shownInUnit("emu", 914_400)).toBe(72)
  expect(shownInUnit("fraction", 80_000)).toBe(80)
})

it("bounds a length to the widest slide PowerPoint allows and refuses a typed number outside the range", () => {
  const length: Desc = { kind: "number", unit: "emu", min: -27_273_042_329_600, max: 27_273_042_316_900 }
  const size: Desc = { kind: "number", unit: "emu", min: 0, max: 27_273_042_316_900 }
  const typeSize: Desc = { kind: "number", unit: "hundredth-point", min: 100, max: 400_000 }
  const count: Desc = { kind: "number", unit: "count", min: 0, max: 10 }
  expect(storedOf(length, 4_032)).toBe(51_206_400)
  expect(storedOf(length, 914_400)).toBeNull()
  expect(storedOf(size, -1)).toBeNull()
  expect(storedOf(typeSize, 0.5)).toBeNull()
  expect(storedOf(count, 2.5)).toBeNull()
  expect(storedOf({ kind: "flag" }, 1)).toBeNull()
})

it("wraps an angle around the circle and clamps every other number to its limit", () => {
  const angle: Desc = { kind: "number", unit: "angle", min: 0, max: 21_599_999 }
  const fraction: Desc = { kind: "number", unit: "fraction", min: 0, max: 100_000 }
  const degrees = (typed: number) => (clampedOf(angle, typed) ?? Number.NaN) / 60_000
  expect(degrees(400)).toBe(40)
  expect(degrees(-10)).toBe(350)
  expect(degrees(720)).toBe(0)
  expect(degrees(360)).toBe(0)
  expect(degrees(359.999999)).toBe(0)
  expect(degrees(-1)).toBe(359)
  expect(clampedOf(fraction, 140)).toBe(100_000)
  expect(clampedOf(fraction, -5)).toBe(0)
})
