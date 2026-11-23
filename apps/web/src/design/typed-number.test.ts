import { expect, it } from "vitest"
import { textCopy } from "@/copy/text-copy"
import type { Desc } from "./control-desc"
import { shownInUnit, storedOf, typedNumber } from "./typed-number"

it("reads a typed value with or without its unit, as Figma's fields do", () => {
  expect(typedNumber("150", {})).toBe(150)
  expect(typedNumber(" 150 % ", {})).toBe(150)
  expect(typedNumber("1,5%", {})).toBe(1.5)
  expect(typedNumber("-2%", {})).toBe(-2)
  expect(typedNumber("wide", {})).toBeNull()
  expect(typedNumber("", {})).toBeNull()
})

it("turns typed points into the field's own unit and refuses points where the field has none", () => {
  expect(typedNumber("24pt", { points: 2.5 })).toBe(60)
  expect(typedNumber("24 PT", { points: 2.5 })).toBe(60)
  expect(typedNumber("24pt", {})).toBeNull()
})

it("reads Auto where the field has one", () => {
  expect(typedNumber(textCopy.auto, { auto: 100 })).toBe(100)
  expect(typedNumber(textCopy.auto.toLowerCase(), { auto: 100 })).toBe(100)
  expect(typedNumber(textCopy.auto, {})).toBeNull()
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
