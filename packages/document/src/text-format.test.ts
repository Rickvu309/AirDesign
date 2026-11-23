import { describe, expect, it } from "vitest"
import { formatRange, type FileFormat } from "./text-format.js"
import type { TextValue } from "./text-value.js"

const plain: FileFormat = () => false
const boldFile: FileFormat = (paragraph, run, format) => paragraph === 0 && run === 1 && format === "bold"

const two: TextValue = [
  {
    from: 0,
    runs: [
      { from: 0, text: "Hello " },
      { from: 1, text: "world" },
    ],
  },
  { from: 1, runs: [{ from: 0, text: "Second line" }] },
]

describe("formatRange", () => {
  it("splits a run at both edges of a range inside it and keeps its from", () => {
    const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "Hello world" }] }]
    const range = { start: { paragraph: 0, offset: 2 }, end: { paragraph: 0, offset: 7 } }
    expect(formatRange(value, range, "bold", true, plain)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "He" },
          { from: 0, text: "llo w", bold: true },
          { from: 0, text: "orld" },
        ],
      },
    ])
  })

  it("formats across runs and paragraphs and leaves the rest alone", () => {
    const range = { start: { paragraph: 0, offset: 3 }, end: { paragraph: 1, offset: 6 } }
    expect(formatRange(two, range, "italic", true, plain)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "Hel" },
          { from: 0, text: "lo ", italic: true },
          { from: 1, text: "world", italic: true },
        ],
      },
      {
        from: 1,
        runs: [
          { from: 0, text: "Second", italic: true },
          { from: 0, text: " line" },
        ],
      },
    ])
  })

  it("returns the value it started from when the same range is turned back", () => {
    const range = { start: { paragraph: 0, offset: 3 }, end: { paragraph: 1, offset: 6 } }
    const on = formatRange(two, range, "underline", true, plain)
    expect(formatRange(on, range, "underline", false, plain)).toEqual(two)
  })

  it("writes off where the file has the format on", () => {
    const range = { start: { paragraph: 0, offset: 6 }, end: { paragraph: 0, offset: 11 } }
    const off = formatRange(two, range, "bold", false, boldFile)
    expect(off[0]?.runs[1]).toEqual({ from: 1, text: "world", bold: false })
    expect(formatRange(off, range, "bold", true, boldFile)).toEqual(two)
  })

  it("keeps a run's other formats when it sets one", () => {
    const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "abcd", italic: true }] }]
    const range = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 2 } }
    expect(formatRange(value, range, "bold", true, plain)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "ab", italic: true, bold: true },
          { from: 0, text: "cd", italic: true },
        ],
      },
    ])
  })
})

describe("formatState", () => {
  it("keeps alignment, bullets, size and colour when it sets bold", () => {
    const value: TextValue = [
      {
        from: 0,
        align: "right",
        list: "bullets",
        runs: [{ from: 0, text: "ab", size: 2000, color: { scheme: "dk1" } }],
      },
    ]
    const range = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 1 } }
    expect(formatRange(value, range, "bold", true, plain)).toEqual([
      {
        from: 0,
        align: "right",
        list: "bullets",
        runs: [
          { from: 0, text: "a", size: 2000, color: { scheme: "dk1" }, bold: true },
          { from: 0, text: "b", size: 2000, color: { scheme: "dk1" } },
        ],
      },
    ])
  })
})
