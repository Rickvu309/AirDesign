import { limits } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { nameReading } from "./deck-name-edit"

describe("nameReading", () => {
  it("accepts a name and trims the spaces around it", () => {
    expect(nameReading("  Q3 plan  ")).toEqual({ ok: true, name: "Q3 plan" })
  })

  it("refuses an empty or blank name and says what to do", () => {
    expect(nameReading("")).toEqual({ ok: false, words: "Enter a name for this deck." })
    expect(nameReading("   ")).toEqual({ ok: false, words: "Enter a name for this deck." })
  })

  it("accepts a name of exactly the limit", () => {
    expect(nameReading("a".repeat(limits.name))).toEqual({ ok: true, name: "a".repeat(limits.name) })
  })

  it("refuses a name past the limit and says the limit", () => {
    expect(nameReading("a".repeat(limits.name + 1))).toEqual({
      ok: false,
      words: `Use ${limits.name} characters or fewer.`,
    })
  })

  it("counts a character that takes two code units as one", () => {
    expect(nameReading("😀".repeat(limits.name)).ok).toBe(true)
  })

  it("refuses text a deck cannot store", () => {
    expect(nameReading("bad\u0000name")).toEqual({ ok: false, words: "Enter a name for this deck." })
  })
})
