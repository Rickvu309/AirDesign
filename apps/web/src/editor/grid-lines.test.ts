import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { gridBaseColumns, gridLayout, gridSpacing, gridWrapColumns } from "@/editor/grid-lines"

const wide = { width: 1920, height: 1080 }

function deckOf(lengths: readonly number[]): readonly (readonly doom.NodeId[])[] {
  let next = 0
  return lengths.map((length) => Array.from({ length }, () => doom.nodeId(`s:${String(next++)}`)))
}

function linesOf(lengths: readonly number[]) {
  const tops = new Map<number, number[]>()
  for (const card of gridLayout(deckOf(lengths), wide).cards)
    tops.set(card.top, [...(tops.get(card.top) ?? []), card.index])
  return [...tops.values()]
}

describe("grid columns", () => {
  it("uses the column count a deck of that length already gets", () => {
    expect([1, 4, 7, 12, 24, 41, 50].map(gridBaseColumns)).toEqual([4, 4, 4, 5, 6, 8, 9])
  })

  it("wraps one group at the deck's column count, and widens several groups only while that removes lines", () => {
    expect(gridWrapColumns([6])).toBe(4)
    expect(gridWrapColumns([10])).toBe(4)
    expect(gridWrapColumns([16])).toBe(5)
    expect(gridWrapColumns([1, 28, 10, 2])).toBe(10)
    expect(gridWrapColumns([1, 10, 10, 8, 10, 2])).toBe(10)
    expect(gridWrapColumns([4, 4])).toBe(4)
    expect(gridWrapColumns([])).toBe(4)
  })
})

describe("grid layout", () => {
  it("starts each slide group on its own line and wraps a long group as one group", () => {
    expect(linesOf([9])).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8]])
    expect(linesOf([1, 28, 10, 2]).map((line) => line.length)).toEqual([1, 10, 10, 8, 10, 2])
    expect(linesOf([4, 4])).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ])
    expect(linesOf(Array(12).fill(2))).toHaveLength(12)
  })

  it("places each slide in deck order with its id, its group and the slide's own size", () => {
    const groups = deckOf([2, 3])
    const { cards } = gridLayout(groups, wide)
    expect(cards.map((card) => card.id)).toEqual(groups.flat())
    expect(cards.map((card) => card.group)).toEqual([0, 0, 1, 1, 1])
    expect(cards.map((card) => card.index)).toEqual([0, 1, 2, 3, 4])
    for (const card of cards) expect([card.width, card.height]).toEqual([1920, 1080])
    const spacing = gridSpacing(wide)
    expect(cards[1]!.left - cards[0]!.left).toBe(1920 + spacing.column)
    expect(cards[0]!.top).toBe(spacing.inset)
    expect(cards[2]!.top - cards[0]!.top).toBe(1080 + spacing.inset + spacing.group)
  })

  it("keeps a wrapped group's lines closer than two groups, with room for the number above", () => {
    const tops = [...new Set(gridLayout(deckOf([12, 2]), wide).cards.map((card) => card.top))]
    expect(tops).toHaveLength(3)
    const spacing = gridSpacing(wide)
    expect(tops[1]! - tops[0]!).toBe(1080 + spacing.inset + spacing.line)
    expect(tops[2]! - tops[1]!).toBe(1080 + spacing.inset + spacing.group)
    expect(spacing.line).toBeLessThan(spacing.group)
    expect((spacing.line + spacing.inset) * (88 / spacing.group)).toBeGreaterThanOrEqual(30)
  })

  it("keeps gaps a share of the slide, and a wrap gap tighter than a group gap when the column gap is wider", () => {
    const spacing = gridSpacing(wide)
    expect(spacing.column).toBeCloseTo(249.6)
    expect(spacing.group).toBeCloseTo(615.6)
    expect(spacing.line).toBeCloseTo(249.6)
    expect(spacing.inset).toBe(36)
    expect(gridSpacing({ width: 100, height: 10 }).line).toBeCloseTo(2.85)
  })

  it("measures the block from the widest line and every line's number room and gap", () => {
    const layout = gridLayout(deckOf([12, 2]), wide)
    const spacing = gridSpacing(wide)
    expect(layout.width).toBe(6 * 1920 + 5 * spacing.column)
    expect(layout.height).toBe(3 * (1080 + spacing.inset) + spacing.line + spacing.group)
    expect(gridLayout([], wide)).toEqual({ cards: [], width: 0, height: 0 })
    expect(gridLayout([[]], wide)).toEqual({ cards: [], width: 0, height: 0 })
  })
})
