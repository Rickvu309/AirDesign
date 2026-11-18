import { describe, expect, it } from "vitest"
import type { ResolvedParagraph, ResolvedRun, ResolvedText } from "./resolved-slide.js"
import { fontFace, layText, type FontWidths } from "./text-fit.js"

const point = 12_700
const letters = "abcdefghijklmnopqrstuvwxyz0123456789-•.,"
const even = Object.fromEntries([...letters].map((char) => [char, 0.5]))
const widths: FontWidths = {
  [fontFace("Plain", false, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25 } },
  [fontFace("Plain", true, false)]: { ascent: 0.8, descent: 0.2, advances: { ...even, " ": 0.25, a: 0.6 } },
  [fontFace("Kerned", false, false)]: {
    ascent: 0.8,
    descent: 0.2,
    advances: { ...even, " ": 0.25 },
    kerning: { ab: -0.1 },
  },
}

function run(text: string, size = 10, more: Partial<ResolvedRun> = {}): ResolvedRun {
  return { text, font: "Plain", size, bold: false, italic: false, color: null, ...more }
}

function paragraph(runs: readonly ResolvedRun[], more: Partial<ResolvedParagraph> = {}): ResolvedParagraph {
  return {
    align: "left",
    level: 0,
    marginLeft: 0,
    indent: 0,
    lineHeight: null,
    spaceBefore: null,
    spaceAfter: null,
    bullet: null,
    runs,
    end: { font: "Plain", size: runs[0]?.size ?? 10 },
    ...more,
  }
}

function text(paragraphs: readonly ResolvedParagraph[], more: Partial<ResolvedText> = {}): ResolvedText {
  return {
    paragraphs,
    insets: { left: 0, top: 0, right: 0, bottom: 0 },
    anchor: "top",
    wrap: true,
    fit: "none",
    fontScale: 1,
    lineReduction: 0,
    vertical: false,
    ...more,
  }
}

function laid(value: ResolvedText, width: number, height = 500) {
  const result = layText(value, { cx: width * point, cy: height * point }, widths)
  if (typeof result === "string") throw new Error(`unjudged: ${result}`)
  return result
}

describe("layText", () => {
  it("keeps words on one line while they fit and gives it 1.2 times the size", () => {
    const result = laid(text([paragraph([run("aaaa bbbb cccc")])]), 100)
    expect(result.lines).toHaveLength(1)
    expect(result.height).toBeCloseTo(12)
    expect(result.lines[0]?.right).toBeCloseTo(65)
  })

  it("moves the word that does not fit to the next line", () => {
    const result = laid(text([paragraph([run("aaaa bbbb cccc")])]), 50)
    expect(result.lines).toHaveLength(2)
    expect(result.height).toBeCloseTo(24)
  })

  it("lets spaces at the end of a line hang past the edge", () => {
    expect(laid(text([paragraph([run("aaaa bbbb   cccc")])]), 42.5).lines).toHaveLength(2)
  })

  it("breaks after a hyphen inside a word, as the painter does between digits too, but not after one that starts a word", () => {
    expect(laid(text([paragraph([run("aaaa-bbbb a")])]), 40).lines[0]?.right).toBeCloseTo(25)
    expect(laid(text([paragraph([run("1234-5678 a")])]), 40).lines[0]?.right).toBeCloseTo(25)
    expect(laid(text([paragraph([run("a -bbbb")])]), 30).lines[0]?.right).toBeCloseTo(5)
  })

  it("splits a word wider than the whole line by letters", () => {
    const result = laid(text([paragraph([run("aaaaaaaaaa")])]), 20)
    expect(result.lines).toHaveLength(3)
  })

  it("starts a new line at a line break", () => {
    expect(laid(text([paragraph([run("aa"), run("\n"), run("bb")])]), 100).lines).toHaveLength(2)
  })

  it("sizes a line by its largest run", () => {
    const result = laid(text([paragraph([run("aa", 10), run(" bb", 20)])]), 100)
    expect(result.height).toBeCloseTo(24)
  })

  it("spaces lines by the paragraph's line height, rounded the way the painter rounds it", () => {
    const result = laid(text([paragraph([run("aaaa bbbb cccc")], { lineHeight: { percent: 0.9 } })]), 50)
    expect(result.height).toBeCloseTo(2 * 10.8)
    const fixed = laid(text([paragraph([run("aaaa bbbb cccc")], { lineHeight: { points: 15 } })]), 50)
    expect(fixed.height).toBeCloseTo(30)
  })

  it("adds space before and after a paragraph, in points or as a share of its largest size", () => {
    const spaced = paragraph([run("aa", 10), run("bb", 20)], {
      spaceBefore: { percent: 0.5 },
      spaceAfter: { points: 6 },
    })
    expect(laid(text([spaced], { edgeSpacing: true }), 100).height).toBeCloseTo(10 + 24 + 6)
  })

  it("leaves out the first paragraph's space before and the last one's space after, as PowerPoint does by default", () => {
    const spaced = paragraph([run("aa", 10)], { spaceBefore: { points: 4 }, spaceAfter: { points: 6 } })
    expect(laid(text([spaced]), 100).height).toBeCloseTo(12)
    expect(laid(text([spaced, spaced]), 100).height).toBeCloseTo(12 + 6 + 4 + 12)
  })

  it("gives an empty paragraph one line at its end size", () => {
    const empty = paragraph([], { end: { font: "Plain", size: 20 } })
    expect(laid(text([paragraph([run("aa")]), empty]), 100).height).toBeCloseTo(12 + 24)
  })

  it("keeps a bullet's line within its paragraph's tight line height, as PowerPoint does", () => {
    const bulleted = (lineHeight: ResolvedParagraph["lineHeight"]) =>
      paragraph([run("aaaa")], { lineHeight, bullet: { text: "•", font: "Plain", size: 10 } })
    expect(laid(text([bulleted({ percent: 0.7 })]), 100).height).toBeCloseTo(8.4)
    expect(laid(text([bulleted({ points: 7 })]), 100).height).toBeCloseTo(7)
    expect(laid(text([bulleted(null)]), 100).height).toBeCloseTo(12)
  })

  it("hangs a bullet in the indent and wraps the rest at the margin", () => {
    const bulleted = paragraph([run("aaaa bbbb cccc")], {
      marginLeft: 20 * point,
      indent: -20 * point,
      bullet: { text: "•", font: "Plain", size: 10 },
    })
    const result = laid(text([bulleted]), 62.5)
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]?.left).toBeCloseTo(0)
    expect(result.lines[1]?.left).toBeCloseTo(20)
  })

  it("scales the text by the stored shrink and takes the stored line reduction off its spacing", () => {
    const shrunk = laid(text([paragraph([run("aaaa bbbb cccc")])], { fontScale: 0.5, lineReduction: 0.2 }), 50)
    expect(shrunk.lines).toHaveLength(1)
    expect(shrunk.height).toBeCloseTo(6 * 0.8)
  })

  it("subtracts the line reduction from percentage spacing and leaves spacing in points, as ECMA-376 says", () => {
    const tight = (lineHeight: ResolvedParagraph["lineHeight"]) =>
      laid(text([paragraph([run("aaaa")], { lineHeight })], { lineReduction: 0.2 }), 100).height
    expect(tight({ percent: 0.9 })).toBeCloseTo(12 * 0.7)
    expect(tight({ points: 15 })).toBeCloseTo(15)
  })

  it("measures bold text with the bold face", () => {
    expect(laid(text([paragraph([run("aaaa", 10, { bold: true })])]), 100).lines[0]?.right).toBeCloseTo(24)
  })

  it("kerns a pair inside one run", () => {
    const kerned = run("abab abab", 10, { font: "Kerned" })
    expect(laid(text([paragraph([kerned], { end: { font: "Kerned", size: 10 } })]), 100).lines[0]?.right).toBeCloseTo(
      42.5 - 4,
    )
  })

  it("places the lines inside the insets and by the anchor", () => {
    const value = text([paragraph([run("aaaa")])], {
      insets: { left: 5 * point, top: 4 * point, right: 5 * point, bottom: 4 * point },
      anchor: "middle",
    })
    const result = laid(value, 110, 100)
    expect(result.room).toBeCloseTo(92)
    expect(result.lines[0]?.top).toBeCloseTo(4 + (92 - 12) / 2)
    expect(result.lines[0]?.left).toBeCloseTo(5)
  })

  it("aligns a line to the right or centre of its room", () => {
    const right = laid(text([paragraph([run("aaaa")], { align: "right" })]), 100)
    expect(right.lines[0]?.left).toBeCloseTo(80)
    const centre = laid(text([paragraph([run("aaaa")], { align: "center" })]), 100)
    expect(centre.lines[0]?.left).toBeCloseTo(40)
  })

  it("reports the glyph band of a line inside its leading", () => {
    const line = laid(text([paragraph([run("aaaa")])]), 100).lines[0]
    expect(line?.glyphTop).toBeCloseTo(1)
    expect(line?.glyphBottom).toBeCloseTo(11)
  })

  it("does not judge text it cannot lay out the way the painter does", () => {
    const box = { cx: 100 * point, cy: 100 * point }
    expect(layText(text([paragraph([run("aa")])], { vertical: true }), box, widths)).toBe("vertical")
    expect(layText(text([paragraph([run("aa", 10, { font: "Other" })])]), box, widths)).toBe("face")
    expect(layText(text([paragraph([run("aZ")])]), box, widths)).toBe("glyph")
    expect(layText(text([paragraph([run("a\tb")])]), box, widths)).toBe("tab")
    expect(layText(text([paragraph([run("مرحبا")])]), box, widths)).toBe("script")
    expect(layText(text([paragraph([run("你好")])]), box, widths)).toBe("script")
  })
})
