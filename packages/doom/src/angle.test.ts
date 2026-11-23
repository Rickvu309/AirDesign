import { expect, it } from "vitest"
import { wrapDegrees } from "./angle.js"

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
