import { expect, it } from "vitest"
import { contrast } from "./contrast.js"

it("measures white on a mid blue at the AA text ratio or better", () => {
  expect(contrast("FFFFFF", "2D6FCD")).toBeGreaterThanOrEqual(4.5)
})

it("gives a colour against itself a ratio of 1", () => {
  expect(contrast("2D6FCD", "2D6FCD")).toBe(1)
})
