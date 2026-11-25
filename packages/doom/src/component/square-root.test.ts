import { expect, it } from "vitest"
import { squareRoot } from "./square-root.js"

it("takes the nonnegative square root of a number", () => {
  expect(squareRoot(0)).toBe(0)
  expect(squareRoot(4)).toBe(2)
  expect(() => squareRoot(-1)).toThrow()
})
