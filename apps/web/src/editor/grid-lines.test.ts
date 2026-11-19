import { describe, expect, it } from "vitest"
import {
  gridBaseColumns,
  gridFrameHeight,
  gridGroupCenter,
  gridHandleCenter,
  gridLineGap,
  gridSlideCenters,
  gridVisualLines,
  gridWrapColumns,
  type GridLineTrack,
} from "@/editor/grid-lines"
import { gridColumns } from "@/editor/grid-zoom"

const groups = (lengths: readonly number[]) => {
  const ranges: { start: number; end: number }[] = []
  let start = 0
  for (const length of lengths) {
    ranges.push({ start, end: start + length })
    start += length
  }
  return ranges
}

const track = (number: number, start: number, end: number, cards = true): GridLineTrack => ({
  number,
  start,
  end,
  heads: cards ? [] : [start],
  cards: cards ? Array.from({ length: end - start }, (_, offset) => start + offset) : [],
})

describe("grid line layout", () => {
  it("uses the column count a deck of that length already gets", () => {
    expect([1, 4, 7, 12, 24, 41, 50].map(gridBaseColumns)).toEqual([4, 4, 4, 5, 6, 8, 9])
  })

  it("wraps one group at the deck's column count, and widens several groups only while that removes lines", () => {
    expect(gridWrapColumns(6, groups([6]))).toBe(gridColumns(6))
    expect(gridColumns(6)).toBe(4)
    expect(gridWrapColumns(10, groups([10]))).toBe(gridColumns(10))
    expect(gridColumns(10)).toBe(4)
    expect(gridWrapColumns(16, groups([16]))).toBe(5)
    expect(
      gridVisualLines([track(0, 0, 6)], gridWrapColumns(6, groups([6]))).map((line) => line.end - line.start),
    ).toEqual([4, 2])
    expect(
      gridVisualLines([track(0, 0, 10)], gridWrapColumns(10, groups([10]))).map((line) => line.end - line.start),
    ).toEqual([4, 4, 2])
    expect(gridWrapColumns(41, groups([1, 28, 10, 2]))).toBe(10)
    expect(gridWrapColumns(41, groups([1, 10, 10, 8, 10, 2]))).toBe(10)
    expect(gridWrapColumns(8, groups([4, 4]))).toBe(4)
  })

  it("wraps a stored group onto several lines and leaves a group that fits on one", () => {
    const wrapped = gridVisualLines([track(0, 0, 1), track(1, 1, 29), track(2, 29, 39), track(3, 39, 41)], 10)
    expect(wrapped.map((line) => [line.number, line.end - line.start])).toEqual([
      [0, 1],
      [1, 10],
      [1, 10],
      [1, 8],
      [2, 10],
      [3, 2],
    ])
    const fitted = gridVisualLines([track(0, 0, 4), track(1, 4, 8)], 8)
    expect(fitted).toEqual([track(0, 0, 4), track(1, 4, 8)])
  })

  it("puts a section heading on the line that contains its first slide", () => {
    const [first, second] = gridVisualLines([{ ...track(0, 0, 20), heads: [0, 12] }], 10)
    expect(first?.heads).toEqual([0])
    expect(second?.heads).toEqual([12])
  })
})

describe("grid line spacing", () => {
  it("keeps lines of one group closer than the gap between groups, with room for the number above", () => {
    const group = 540 * 0.57
    const column = 960 * 0.13
    const gap = gridLineGap(group, column)
    expect(gap).toBeLessThan(group)
    expect(gap).toBeCloseTo(column)
    const scale = 88 / group
    expect((gap + 24) * scale).toBeGreaterThanOrEqual(30)
  })

  it("stays tighter than the group gap when the column gap is already wider", () => {
    expect(gridLineGap(40, 80)).toBe(20)
  })
})

describe("grid handle position", () => {
  it("centres one line on the slide, and several lines on the midpoint of the first and last slides", () => {
    expect(gridHandleCenter(1, 12, 100, 20)).toBe(12 + 24 + 50)
    const centers = gridSlideCenters(
      [
        { cards: [0], heading: 0 },
        { cards: [1], heading: 0 },
        { cards: [2], heading: 0 },
      ],
      100,
      [20, 20, 0],
    )
    expect(gridGroupCenter(centers)).toBe(gridHandleCenter(3, 0, 100, 20))
    expect(centers[1]! - centers[0]!).toBe(100 + 24 + 20)
    expect(gridFrameHeight([{ cards: [0], heading: 12 }], 100, [40])).toBe(12 + 100 + 24)
    expect(
      gridFrameHeight(
        [
          { cards: [0], heading: 0 },
          { cards: [1], heading: 0 },
          { cards: [2], heading: 0 },
        ],
        100,
        [20, 20, 80],
      ),
    ).toBe(3 * (100 + 24) + 2 * 20)
  })
})
