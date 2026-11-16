import { expect, it } from "vitest"
import { clockText } from "./present-clock"

it("shows minutes and seconds under an hour", () => {
  expect(clockText(0)).toBe("00:00")
  expect(clockText(252.9)).toBe("04:12")
  expect(clockText(3599)).toBe("59:59")
})

it("adds hours from the first hour on", () => {
  expect(clockText(3600)).toBe("1:00:00")
  expect(clockText(3723)).toBe("1:02:03")
})

it("shows zero for a time it cannot read", () => {
  expect(clockText(-5)).toBe("00:00")
  expect(clockText(Number.NaN)).toBe("00:00")
})
