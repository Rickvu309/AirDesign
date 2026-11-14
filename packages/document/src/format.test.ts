import { expect, it } from "vitest"
import { format, formatOf, newerFormat, stamps } from "./format.js"

it("keeps each stamp a whole number from 0", () => {
  for (const stamp of Object.values(stamps)) {
    expect(Number.isSafeInteger(stamp)).toBe(true)
    expect(stamp).toBeGreaterThanOrEqual(0)
  }
})

it("reads something stored with no format as format 1", () => {
  expect(formatOf({ kind: "pending" })).toBe(1)
  expect(formatOf(undefined)).toBe(1)
  expect(formatOf({ format: "2" })).toBe(1)
  expect(formatOf({ format: 1.5 })).toBe(1)
})

it("names a format above this build's as newer", () => {
  expect(formatOf({ format: format + 1 })).toBe(format + 1)
  expect(newerFormat({ format: format + 1 })).toBe(true)
  expect(newerFormat({ format })).toBe(false)
  expect(newerFormat({})).toBe(false)
})
