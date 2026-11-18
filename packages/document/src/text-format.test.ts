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
  steppedSize,
  stepSize,
  typedSize,
  type FileAlign,
  type FileList,
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

const noSize: FileSize = () => null
const noColor: FileColor = () => null
const noBullet: FileList = () => "none"
const sizedFile: FileSize = (paragraph, run) => (paragraph === 0 && run === 0 ? 1800 : null)
const coloredFile: FileColor = (paragraph, run) => (paragraph === 0 && run === 0 ? { scheme: "dk1" } : null)
const alignedFile: FileAlign = (paragraph) => (paragraph === 0 ? "left" : null)
const bulletedFile: FileList = (paragraph) => (paragraph === 1 ? "bullets" : "none")

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

  it("steps each covered run from its own size to the next size on PowerPoint's list and clamps the ends", () => {
    const value: TextValue = [
      {
        from: 0,
        runs: [
          { from: 0, text: "a", size: 2000 },
          { from: 1, text: "b" },
        ],
      },
    ]
    expect(stepSize(value, null, 1, sizedFile)).toEqual([
      {
        from: 0,
        runs: [
          { from: 0, text: "a", size: 2400 },
          { from: 1, text: "b", size: 2000 },
        ],
      },
    ])
    const floor: TextValue = [{ from: 0, runs: [{ from: 0, text: "a", size: 100 }] }]
    const ceiling: TextValue = [{ from: 0, runs: [{ from: 0, text: "a", size: 400000 }] }]
    expect(stepSize(floor, null, -1, noSize)).toEqual(floor)
    expect(stepSize(ceiling, null, 1, noSize)).toEqual(ceiling)
    expect(sizeState(value, null, sizedFile)).toBe("mixed")
    expect(sizeState(floor, null, noSize)).toBe(100)
  })

  it("steps through PowerPoint's size list, by a point below it and by ten points above it", () => {
    const climb = (from: number, steps: number) =>
      Array.from({ length: steps }).reduce<number[]>((sizes) => [...sizes, steppedSize(sizes.at(-1) ?? from, 1)], [])
    expect(climb(1800, 4)).toEqual([2000, 2400, 2800, 3200])
    expect(climb(4000, 8)).toEqual([4400, 4800, 5400, 6000, 6600, 7200, 8000, 8800])
    expect(climb(600, 6)).toEqual([700, 800, 900, 1000, 1050, 1100])
    expect(climb(9600, 2)).toEqual([10000, 11000])
    expect(steppedSize(1900, 1)).toBe(2000)
    expect(steppedSize(1900, -1)).toBe(1800)
    expect(steppedSize(3300, -1)).toBe(3200)
    expect(steppedSize(1050, -1)).toBe(1000)
    expect(steppedSize(800, -1)).toBe(700)
    expect(steppedSize(750, -1)).toBe(700)
    expect(steppedSize(10600, -1)).toBe(10000)
    expect(steppedSize(10000, -1)).toBe(9600)
    expect(steppedSize(100, -1)).toBe(100)
    expect(steppedSize(400000, 1)).toBe(400000)
  })

  it("reads a typed size in points to the tenth and refuses one outside 1 to 4000", () => {
    expect(typedSize("24")).toBe(2400)
    expect(typedSize(" 10.5 ")).toBe(1050)
    expect(typedSize("11.26")).toBe(1130)
    expect(typedSize("4000")).toBe(400000)
    expect(typedSize("1")).toBe(100)
    expect(typedSize("0.5")).toBeNull()
    expect(typedSize("4001")).toBeNull()
    expect(typedSize("")).toBeNull()
    expect(typedSize("big")).toBeNull()
    expect(typedSize("12pt")).toBeNull()
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
      { from: 1, list: "none", runs: [{ from: 0, text: "" }] },
    ])
    expect(alignState(value, null, alignedFile)).toBe("mixed")
    expect(alignState(value, first, alignedFile)).toBe("left")
    expect(bulletState(value, null, bulletedFile)).toBe("mixed")
    expect(bulletState(value, first, noBullet)).toBe("off")
    expect(colorState(value, first, noColor)).toBeNull()
  })
})
