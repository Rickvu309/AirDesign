import { expect, it } from "vitest"
import { textCopy } from "@/copy/text-copy"
import { typedNumber } from "./typed-number"

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
