import { describe, expect, it } from "vitest"
import {
  alignRange,
  alignState,
  bulletRange,
  bulletState,
  colorRange,
  colorState,
  formatRange,
  formatState,
  formatWhole,
  sizeRange,
  sizeState,
  stepSize,
  type FileAlign,
  type FileBullet,
  type FileColor,
  type FileFormat,
  type FileSize,
} from "./text-format.js"
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

describe("formatWhole", () => {
  it("formats every run, empty runs too", () => {
    const value: TextValue = [
      { from: 0, runs: [{ from: 0, text: "a" }] },
      { from: 1, runs: [{ from: 0, text: "" }] },
    ]
    expect(formatWhole(value, "bold", true, plain)).toEqual([
      { from: 0, runs: [{ from: 0, text: "a", bold: true }] },
      { from: 1, runs: [{ from: 0, text: "", bold: true }] },
    ])
  })
})

describe("formatState", () => {
  it("says on, off or mixed for the characters in the range", () => {
    const at = (start: number, end: number) => ({
      start: { paragraph: 0, offset: start },
      end: { paragraph: 0, offset: end },
    })
    expect(formatState(two, at(0, 6), "bold", boldFile)).toBe("off")
    expect(formatState(two, at(6, 11), "bold", boldFile)).toBe("on")
    expect(formatState(two, at(4, 8), "bold", boldFile)).toBe("mixed")
  })

  it("reads the whole box when there is no range", () => {
    expect(formatState(two, null, "bold", boldFile)).toBe("mixed")
    expect(formatState(two, null, "italic", boldFile)).toBe("off")
  })

  it("reads a set format before the file's", () => {
    const value: TextValue = [{ from: 0, runs: [{ from: 1, text: "x", bold: false }] }]
    expect(formatState(value, null, "bold", boldFile)).toBe("off")
  })

  it("keeps alignment, bullets, size and colour when it sets bold", () => {
    const value: TextValue = [
      {
        from: 0,
        align: "right",
        bullet: true,
        runs: [{ from: 0, text: "ab", size: 2000, color: { scheme: "dk1" } }],
      },
    ]
    const range = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 1 } }
    expect(formatRange(value, range, "bold", true, plain)).toEqual([
      {
        from: 0,
        align: "right",
        bullet: true,
        runs: [
          { from: 0, text: "a", size: 2000, color: { scheme: "dk1" }, bold: true },
          { from: 0, text: "b", size: 2000, color: { scheme: "dk1" } },
        ],
      },
    ])
  })
})

const noSize: FileSize = () => null
const noColor: FileColor = () => null
const noBullet: FileBullet = () => false
const sizedFile: FileSize = (paragraph, run) => (paragraph === 0 && run === 0 ? 1800 : null)
const coloredFile: FileColor = (paragraph, run) => (paragraph === 0 && run === 0 ? { scheme: "dk1" } : null)
const alignedFile: FileAlign = (paragraph) => (paragraph === 0 ? "left" : null)
const bulletedFile: FileBullet = (paragraph) => paragraph === 1

describe("size, colour, alignment and bullets", () => {
  const inside = { start: { paragraph: 0, offset: 1 }, end: { paragraph: 0, offset: 3 } }

  it("omits a size or colour that matches the file and stores one that does not", () => {
    const value: TextValue = [{ from: 0, runs: [{ from: 0, text: "abcd" }] }]
    expect(sizeRange(value, inside, 1800, sizedFile)).toEqual(value)
    expect(sizeRange(value, inside, 2400, sizedFile)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "a" },
          { from: 0, text: "bc", size: 2400 },
          { from: 0, text: "d" },
        ],
      },
    ])
    expect(colorRange(value, inside, { scheme: "dk1" }, coloredFile)).toEqual(value)
    expect(colorRange(value, inside, { rgb: "FF0000" }, coloredFile)[0]?.runs[1]).toEqual({
      from: 0,
      text: "bc",
      color: { rgb: "FF0000" },
    })
  })

  it("steps each covered run from its own size and clamps the ends", () => {
    const value: TextValue = [
      {
        from: 0,
        runs: [
          { from: 0, text: "a", size: 2000 },
          { from: 1, text: "b" },
        ],
      },
    ]
    expect(stepSize(value, null, 100, sizedFile)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "a", size: 2100 },
          { from: 1, text: "b", size: 1900 },
        ],
      },
    ])
    const floor: TextValue = [{ from: 0, runs: [{ from: 0, text: "a", size: 100 }] }]
    const ceiling: TextValue = [{ from: 0, runs: [{ from: 0, text: "a", size: 400000 }] }]
    expect(stepSize(floor, null, -100, noSize)).toEqual(floor)
    expect(stepSize(ceiling, null, 100, noSize)).toEqual(ceiling)
    expect(sizeState(value, null, sizedFile)).toBe("mixed")
    expect(sizeState(floor, null, noSize)).toBe(100)
  })

  it("omits alignment or bullets that match the file, including an empty paragraph", () => {
    const value: TextValue = [
      { from: 0, runs: [{ from: 0, text: "ab" }] },
      { from: 1, runs: [{ from: 0, text: "" }] },
    ]
    const first = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 0 } }
    expect(alignRange(value, first, "left", alignedFile)).toEqual(value)
    expect(alignRange(value, null, "center", alignedFile)).toEqual([
      { from: 0, align: "center", runs: [{ from: 0, text: "ab" }] },
      { from: 1, align: "center", runs: [{ from: 0, text: "" }] },
    ])
    expect(bulletRange(value, null, false, bulletedFile)).toEqual([
      { from: 0, runs: [{ from: 0, text: "ab" }] },
      { from: 1, bullet: false, runs: [{ from: 0, text: "" }] },
    ])
    expect(alignState(value, null, alignedFile)).toBe("mixed")
    expect(alignState(value, first, alignedFile)).toBe("left")
    expect(bulletState(value, null, bulletedFile)).toBe("mixed")
    expect(bulletState(value, first, noBullet)).toBe("off")
    expect(colorState(value, first, noColor)).toBeNull()
  })
})
