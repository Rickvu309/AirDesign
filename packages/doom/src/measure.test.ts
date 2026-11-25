import { describe, expect, it } from "vitest"
import type { FontWidths } from "./line-breaks.js"
import { type Text, type Theme, measureWith } from "./index.js"
import { textOf, theme } from "./sample-deck.js"

const plain: Theme = {
  ...theme(),
  fonts: { heading: "Inter", body: "Inter" },
  textStyles: {
    ...theme().textStyles,
    body: { size: 20, font: "body", weight: 400, lineHeight: 1.5, tracking: 0 },
  },
}
const advance = 11
const lineHeight = 30
const measure = measureWith({})
const words = (chars: string, extra: Partial<Text> = {}): Text => ({ ...textOf(chars), ...extra })

describe("measureWith", () => {
  it("measures one line with the advance of every character and the line height of its style", () => {
    const result = measure(words("Revenue"), plain, null)
    expect(result.w).toBeCloseTo(7 * advance)
    expect(result.h).toBe(lineHeight)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]).toMatchObject({ start: 0, end: 7, y: 0, h: lineHeight, x: 0 })
  })

  it("breaks at spaces when the width is too small and leaves the trailing space out of the width", () => {
    const result = measure(words("aaaa bbbb cccc"), plain, 80)
    expect(result.lines.map(({ start, end }) => [start, end])).toEqual([
      [0, 5],
      [5, 10],
      [10, 14],
    ])
    expect(result.lines.map(({ y }) => y)).toEqual([0, lineHeight, 2 * lineHeight])
    expect(result.h).toBe(3 * lineHeight)
    expect(result.w).toBe(80)
  })

  it("keeps two words on a line that is wide enough, and hugs the widest line when no width is given", () => {
    expect(measure(words("aaaa bbbb cccc"), plain, 100).lines).toHaveLength(2)
    const hug = measure(words("aaaa bbbb\ncc"), plain, null)
    expect(hug.w).toBeCloseTo(9 * advance)
    expect(hug.lines).toHaveLength(2)
  })

  it("starts a new line at a paragraph break and adds the paragraph's spacing between paragraphs only", () => {
    const text = words("one\ntwo", { paras: [{ spaceAfter: 8 }, { spaceBefore: 4, spaceAfter: 50 }] })
    const result = measure(text, plain, null)
    expect(result.lines.map(({ y }) => y)).toEqual([0, lineHeight + 8 + 4])
    expect(result.h).toBe(2 * lineHeight + 12)
  })

  it("gives an empty paragraph one line of its style's height", () => {
    const result = measure(words("a\n\nb"), plain, null)
    expect(result.lines).toHaveLength(3)
    expect(result.h).toBe(3 * lineHeight)
  })

  it("measures a bold span with the bold face and sizes the line by its largest run", () => {
    const widths: FontWidths = { "Inter|bold": { ascent: 0.9, descent: 0.2, advances: { b: 1 } } }
    const text = words("ab", { spans: [{ end: 1 }, { end: 2, bold: true, size: 40 }] })
    const result = measureWith(widths)(text, plain, null)
    expect(result.w).toBeCloseTo(20 * 0.55 + 40 * 1)
    expect(result.lines[0]?.h).toBe(60)
    expect(result.lines[0]?.runs.map((run) => [run.text, run.size, run.bold])).toEqual([
      ["a", 20, false],
      ["b", 40, true],
    ])
  })

  it("adds a pair's kerning and the tracking of each character", () => {
    const widths: FontWidths = {
      Inter: { ascent: 0.9, descent: 0.2, advances: { a: 0.5, v: 0.5 }, kerning: { av: -0.1 } },
    }
    const kerned = measureWith(widths)(words("av"), plain, null)
    expect(kerned.w).toBeCloseTo(20 * (0.5 + 0.5 - 0.1))
    const tracked = measureWith(widths)(words("av", { spans: [{ end: 2, tracking: 2 }] }), plain, null)
    expect(tracked.w).toBeCloseTo(20 * 0.9 + 4)
  })

  it("resolves a span's colour against the theme and the default colour to the theme text colour", () => {
    const text = words("ab", { spans: [{ end: 1, color: { var: "accent1" } }, { end: 2 }] })
    const runs = measure(text, plain, null).lines[0]?.runs
    expect(runs?.map((run) => run.color)).toEqual([plain.colors.accent1, plain.colors.text])
  })

  it("applies upper case to the characters it measures", () => {
    const text = words("ab", { spans: [{ end: 2, case: "upper" }] })
    expect(measure(text, plain, null).lines[0]?.runs[0]?.text).toBe("AB")
  })

  it("aligns each line inside the width and puts padding around the lines", () => {
    const text = words("ab\ncd", {
      paras: [{ align: "center" }, { align: "right" }],
      padding: { t: 10, r: 6, b: 4, l: 12 },
    })
    const result = measure(text, plain, 200)
    expect(result.h).toBe(2 * lineHeight + 14)
    expect(result.lines[0]).toMatchObject({ x: 12, w: 182, y: 10, align: "center" })
    expect(result.lines[1]).toMatchObject({ y: 10 + lineHeight, align: "right" })
  })

  it("hangs a bullet and counts a numbered list by level", () => {
    const text = words("a\nb\nc\nd", {
      paras: [{ list: "bullet" }, { list: "number" }, { list: "number" }, { list: "number", level: 1 }],
    })
    const labels = measure(text, plain, 400).lines.map((line) => line.label?.run.text)
    expect(labels).toEqual(["•", "1.", "2.", "1."])
    const [first, , , nested] = measure(text, plain, 400).lines
    expect((nested?.x ?? 0) > (first?.x ?? 0)).toBe(true)
  })

  it("is the same on every call: no state carries between measurements", () => {
    const text = words("the quick brown fox jumps over the lazy dog")
    expect(measure(text, plain, 150)).toEqual(measure(text, plain, 150))
  })
})

it("kerns across colour spans with the same metrics", () => {
  const width = measureWith({
    Inter: { ascent: 1, descent: 0, advances: { A: 0.5, V: 0.5 }, kerning: { AV: -0.1 } },
  })
  const text = words("AV", { spans: [{ end: 1, color: { var: "accent1" } }, { end: 2 }] })
  expect(width(text, plain, null).w).toBe(18)
  expect(width({ ...text, spans: [text.spans[0]!, { end: 2, size: 22 }] }, plain, null).w).toBe(21)
})

it("counts a discretionary hyphen only when that mark ends the line", () => {
  const width = measureWith({
    Inter: { ascent: 1, descent: 0, advances: { a: 0.5, b: 0.5, "‐": 0.3 } },
  })
  const text = words("aa\u00adbb", { wrap: "words" })
  expect(width(text, plain, null).w).toBe(40)
  expect(width(text, plain, 30).lines.map(({ end, ink }) => [end, ink])).toEqual([
    [3, 26],
    [5, 20],
  ])
})
