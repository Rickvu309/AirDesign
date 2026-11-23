import { describe, expect, it } from "vitest"
import { textFromMarkdown } from "./markdown.js"
import type { Text } from "./text.js"
import { lookWrite, paraWrite, styleWrite } from "./text-writes.js"

const typed: Text = {
  ...textFromMarkdown("Q3 update", "body"),
  spans: [{ end: 9, size: 32, font: "Inter", bold: true, italic: true }],
}

describe("the text writes a person and an agent share", () => {
  it("makes text the named style whole, dropping the size, font, bold and line height set on it", () => {
    const titled = styleWrite(paraWrite(typed, { lineHeight: 1.4 }), "title")
    expect(titled.style).toBe("title")
    expect(titled.spans).toEqual([{ end: 9, italic: true }])
    expect(titled.paras).toEqual([{}])
  })

  it("sets one look on every word, and none clears the letter case", () => {
    const upper = lookWrite(textFromMarkdown("Q3 update", "body"), { size: 40, case: "upper" })
    expect(upper.spans).toEqual([{ end: 9, size: 40, case: "upper" }])
    expect(lookWrite(upper, { case: "none" }).spans).toEqual([{ end: 9, size: 40 }])
  })
})
