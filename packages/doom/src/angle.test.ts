import { expect, it } from "vitest"
import { readRotation, wrapDegrees, wrapRotation } from "./angle.js"

it("wraps degrees onto the circle after rounding to a whole degree", () => {
  expect(wrapDegrees(400)).toBe(40)
  expect(wrapDegrees(-10)).toBe(350)
  expect(wrapDegrees(720)).toBe(0)
  expect(wrapDegrees(360)).toBe(0)
  expect(wrapDegrees(-0.5)).toBe(0)
  expect(wrapDegrees(359.6)).toBe(0)
  expect(wrapDegrees(359.4)).toBe(359)
  expect(wrapDegrees(12.5)).toBe(13)
  expect(Object.is(wrapDegrees(-0.2), 0)).toBe(true)
})

it("wraps a rotation onto 0 up to 360 in tenths of a degree, never to 360 or -0", () => {
  expect(wrapRotation(400)).toBe(40)
  expect(wrapRotation(-90)).toBe(270)
  expect(wrapRotation(-360)).toBe(0)
  expect(wrapRotation(12.34)).toBe(12.3)
  expect(wrapRotation(359.97)).toBe(0)
  expect(wrapRotation(359.94)).toBe(359.9)
  expect(wrapRotation(-0.04)).toBe(0)
  expect(Object.is(wrapRotation(-0.04), 0)).toBe(true)
  expect(wrapRotation(1e9 + 0.5)).toBe(280.5)
})

it("reads a rotation from any finite number and refuses the rest", () => {
  expect(readRotation(-90)).toBe(270)
  expect(() => readRotation("90")).toThrow()
  expect(() => readRotation(Infinity)).toThrow()
})
