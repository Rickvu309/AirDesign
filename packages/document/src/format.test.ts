import { expect, it } from "vitest"
import { stamps } from "./format.js"

it("keeps each stamp a whole number from 0", () => {
  for (const stamp of Object.values(stamps)) {
    expect(Number.isSafeInteger(stamp)).toBe(true)
    expect(stamp).toBeGreaterThanOrEqual(0)
  }
})
