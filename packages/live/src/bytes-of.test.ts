import { bytesOf } from "@airdesign/document"
import fc from "fast-check"
import { describe, expect, it } from "vitest"

describe("bytesOf", () => {
  it("agrees with TextEncoder for any binary string", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (value) => {
        expect(bytesOf(value)).toBe(new TextEncoder().encode(value).length)
      }),
    )
  })

  it("agrees with TextEncoder for strings containing lone surrogates", () => {
    const codeUnits = fc.array(fc.integer({ min: 0, max: 0xffff })).map((units) => String.fromCharCode(...units))
    fc.assert(
      fc.property(codeUnits, fc.integer({ min: 0xd800, max: 0xdfff }), codeUnits, (before, lone, after) => {
        const value = `${before}\u0000${String.fromCharCode(lone)}\u0000${after}`
        expect(bytesOf(value)).toBe(new TextEncoder().encode(value).length)
      }),
    )
  })
})
