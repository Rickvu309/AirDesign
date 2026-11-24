import { describe, expect, it } from "vitest"
import { bytesOf, limits } from "./limits.js"
import { sourceLine } from "./source-line.js"

describe("a slide's source line", () => {
  it("trims the ends and keeps ordinary words as they are", () => {
    expect(sourceLine("  Source: Company filings, 2026  ")).toBe("Source: Company filings, 2026")
    expect(sourceLine("Source:  two  spaces")).toBe("Source:  two  spaces")
  })

  it("turns every line break into one space, even a run of them", () => {
    expect(sourceLine("Source: A\nB")).toBe("Source: A B")
    expect(sourceLine("Source: A \r\n\r\n B\tC\u2028D")).toBe("Source: A B C D")
    expect(sourceLine("\n\nSource: A\n\n")).toBe("Source: A")
  })

  it("drops control characters and lone surrogates, and keeps whole emoji", () => {
    expect(sourceLine("So\u0000ur\u0007ce\u007f\u009f")).toBe("Source")
    expect(sourceLine("A\ud83dB\ude00C")).toBe("ABC")
    expect(sourceLine("Source 📊")).toBe("Source 📊")
  })

  it("cuts at the byte cap on a whole character, never inside one", () => {
    const ascii = "a".repeat(limits.source)
    expect(sourceLine(`${ascii}b`)).toBe(ascii)
    const nearly = "a".repeat(limits.source - 3)
    expect(sourceLine(`${nearly}😀`)).toBe(nearly)
    expect(sourceLine(`${nearly}é😀`)).toBe(`${nearly}é`)
    const accented = "é".repeat(limits.source)
    expect(bytesOf(sourceLine(accented))).toBe(limits.source)
    expect(sourceLine(accented)).toBe("é".repeat(limits.source / 2))
  })

  it("leaves no space at the cut", () => {
    const text = `${"a".repeat(limits.source - 1)} tail`
    expect(sourceLine(text)).toBe("a".repeat(limits.source - 1))
  })

  it("gives the same words when applied again", () => {
    for (const raw of ["  A\n\nB 😀 ", `${"é".repeat(400)}`, "\u0000", ""]) {
      expect(sourceLine(sourceLine(raw))).toBe(sourceLine(raw))
    }
  })
})
