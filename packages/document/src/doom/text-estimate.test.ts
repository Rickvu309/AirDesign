import { describe, expect, it } from "vitest"
import { textFromMarkdown } from "./markdown.js"
import { theme } from "./sample-deck.js"
import { textHeight, widestLine, wrappedLines } from "./text-estimate.js"

const words = theme()
const body = (markdown: string) => textFromMarkdown(markdown, "body")

describe("textHeight", () => {
  it("is one line of the style's size and line height for a short line", () => {
    expect(textHeight(body("Revenue"), words, 1000)).toBeCloseTo(32 * 1.2)
  })

  it("grows as the width shrinks, a line at a time", () => {
    const text = body("Revenue grew while margin held across every region we sell into this year")
    const heights = [1200, 800, 400, 200].map((width) => textHeight(text, words, width))
    expect(heights).toEqual([...heights].sort((a, b) => a - b))
    expect(heights[3]).toBeGreaterThan(heights[0]! * 3)
  })

  it("adds a line for each paragraph, and room between bullets", () => {
    const plain = textHeight(body("a\nb"), words, 1000)
    const listed = textHeight(body("- a\n- b"), words, 1000)
    expect(plain).toBeCloseTo(2 * 32 * 1.2)
    expect(listed).toBeGreaterThan(plain)
  })

  it("narrows the room for an indented bullet", () => {
    const flat = textHeight(body("- " + "word ".repeat(30)), words, 600)
    const deep = textHeight(body("    - " + "word ".repeat(30)), words, 600)
    expect(deep).toBeGreaterThanOrEqual(flat)
  })

  it("counts padding", () => {
    const padded = { ...body("a"), padding: { t: 10, r: 0, b: 6, l: 0 } }
    expect(textHeight(padded, words, 1000)).toBeCloseTo(32 * 1.2 + 16)
  })
})

describe("wrappedLines and widestLine", () => {
  it("breaks at spaces, and splits a word that is wider than the room", () => {
    expect(wrappedLines("aaa bbb ccc", 100, false)).toBe(1)
    expect(wrappedLines("aaa bbb ccc", 3, false)).toBe(3)
    expect(wrappedLines("a".repeat(40), 5, false)).toBe(5)
  })

  it("measures capitals wider than lower case, and upper-case styles wider than the same words", () => {
    expect(wrappedLines("WWWW WWWW", 3, false)).toBeGreaterThan(wrappedLines("iiii iiii", 3, false))
    expect(
      widestLine(
        ["Revenue"],
        { ...words, textStyles: { ...words.textStyles, body: { ...words.textStyles.body, case: "upper" } } },
        "body",
      ),
    ).toBeGreaterThan(widestLine(["Revenue"], words, "body"))
  })

  it("answers the widest of several lines in pixels", () => {
    expect(widestLine(["ab", "abcdef"], words, "body")).toBeGreaterThan(widestLine(["ab"], words, "body"))
    expect(widestLine([], words, "body")).toBe(0)
  })
})
