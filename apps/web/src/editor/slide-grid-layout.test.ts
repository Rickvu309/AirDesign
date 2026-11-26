import { expect, it } from "vitest"
import { gridBlock, gridColumns, gridFitScale, gridGapAfter, gridGroups, gridLines } from "./slide-grid-layout"

const slide = { width: 1920, height: 1080 }

it("reads slide groups from where each one starts", () => {
  expect(gridGroups(9, [])).toEqual([{ start: 0, end: 9 }])
  expect(gridGroups(6, [2, 4])).toEqual([
    { start: 0, end: 2 },
    { start: 2, end: 4 },
    { start: 4, end: 6 },
  ])
  expect(gridGroups(0, [])).toEqual([])
})

it("chooses the column count once for the deck, between four and ten", () => {
  expect(gridColumns(1, gridGroups(1, []))).toBe(4)
  expect(gridColumns(9, gridGroups(9, []))).toBe(4)
  expect(gridColumns(41, gridGroups(41, []))).toBe(8)
  expect(gridColumns(200, gridGroups(200, []))).toBe(10)
})

it("starts each slide group on its own line and wraps a long group as one group", () => {
  expect(gridLines(9, gridGroups(9, [])).map((line) => line.cards)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8]])
  const twelve = gridLines(
    24,
    gridGroups(
      24,
      Array.from({ length: 11 }, (_, index) => (index + 1) * 2),
    ),
  )
  expect(twelve).toHaveLength(12)
  expect(twelve[3]).toEqual({ group: 3, cards: [6, 7] })
})

it("keeps a wrapped group's lines closer than two groups", () => {
  const lines = gridLines(20, gridGroups(20, [18]))
  expect(lines.map((line) => line.group)).toEqual([0, 0, 1])
  expect(gridGapAfter(lines, 0, slide)).toBeLessThan(gridGapAfter(lines, 1, slide))
  expect(gridGapAfter(lines, 2, slide)).toBe(0)
})

it("fits the whole deck inside the room with a margin, by its tighter side", () => {
  const lines = gridLines(9, gridGroups(9, []))
  const block = gridBlock(lines, slide)
  const wide = gridFitScale(lines, slide, { width: 1200, height: 4000 })
  expect(block.width * wide).toBeCloseTo(1200 - 96)
  const tall = gridFitScale(lines, slide, { width: 4000, height: 800 })
  expect(block.height * tall + lines.length * 24).toBeCloseTo(800 - 96)
  expect(gridFitScale(lines, slide, { width: 10, height: 10 })).toBe(0.01)
})
