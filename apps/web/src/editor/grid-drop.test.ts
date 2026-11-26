import { describe, expect, it } from "vitest"
import {
  dropAt,
  dropPlace,
  dropTarget,
  gridBands,
  gridDrop,
  gridRanges,
  liveTarget,
  moveBelowPlace,
  previewSlot,
  groupDrop,
  groupPan,
  slotUnder,
  terminalGroupBand,
} from "@/editor/grid-drop"
import { gridLayout } from "@/editor/grid-lines"
import { nodeId } from "@airdesign/doom"

const card = { left: 100, width: 300 }

describe("grid drop", () => {
  it("drops before a slide on its left half and after it on its right half", () => {
    expect(dropPlace(120, card, 4)).toBe(4)
    expect(dropPlace(249, card, 4)).toBe(4)
    expect(dropPlace(251, card, 4)).toBe(5)
    expect(dropPlace(399, card, 4)).toBe(5)
  })

  it("moves a slide to the place it was dropped, counting the gap it leaves", () => {
    expect(dropTarget(0, 3)).toBe(2)
    expect(dropTarget(0, 4)).toBe(3)
    expect(dropTarget(3, 0)).toBe(0)
    expect(dropTarget(3, 1)).toBe(1)
  })

  it("does nothing when a slide is dropped beside itself", () => {
    expect(dropTarget(2, 2)).toBeNull()
    expect(dropTarget(2, 3)).toBeNull()
  })
})

describe("drag preview", () => {
  it("shows each slide at the slot it takes after the move, and leaves the others where they are", () => {
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 1, 3))).toEqual([0, 3, 1, 2, 4])
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 3, 0))).toEqual([1, 2, 3, 0, 4])
    expect([0, 1, 2].map((index) => previewSlot(index, 1, null))).toEqual([0, 1, 2])
  })

  const cards = [0, 1, 2, 3, 4].map((index) => ({
    id: nodeId(`s:${String(index)}`),
    index,
    group: 0,
    left: index * 340,
    top: 0,
    width: 300,
    height: 169,
  }))
  const groups = [{ start: 0, end: 5 }]
  const gaps = { column: 40, line: 60 }

  it("finds the slot under the pointer, counting half of each gap to its nearer slide", () => {
    expect(slotUnder({ x: 150, y: 80 }, cards, groups, gaps)?.index).toBe(0)
    expect(slotUnder({ x: 319, y: 80 }, cards, groups, gaps)?.index).toBe(0)
    expect(slotUnder({ x: 321, y: 80 }, cards, groups, gaps)?.index).toBe(1)
    expect(slotUnder({ x: 150, y: -29 }, cards, groups, gaps)?.index).toBe(0)
    expect(slotUnder({ x: 150, y: 400 }, cards, groups, gaps)).toBeUndefined()
  })

  it("extends a group end through its gap and leaves the distant canvas empty", () => {
    const right = 4 * 340 + 300
    expect(slotUnder({ x: right + 30, y: 80 }, cards, groups, gaps)?.index).toBe(4)
    expect(slotUnder({ x: right + 41, y: 80 }, cards, groups, gaps)).toBeUndefined()
  })
})

describe("moving slides between slide groups", () => {
  const groups = [
    { start: 0, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 8 },
  ]

  it("accepts a drop that changes groups without changing slide order", () => {
    expect(gridDrop(groups, [5], 5, "same")).toBe(5)
    expect(gridDrop(groups, [5, 6], 5, "same")).toBe(5)
    expect(gridDrop(groups, [5, 6, 7], 5, "same")).toBe(5)
    expect(gridDrop(groups, [3], 4, "new")).toBe(3)
  })

  it("distinguishes a group start from the previous group end at the same position", () => {
    expect(gridDrop(groups, [3], 4, "same")).toBeNull()
    expect(gridDrop(groups, [3], 4, "before")).toBe(3)
    expect(gridDrop(groups, [3, 4], 5, "before")).toBe(3)
    expect(gridDrop(groups, [5, 6], 0, "before")).toBe(0)
  })

  it("uses the first unheld slide in the destination group as the anchor", () => {
    expect(gridDrop(groups, [0, 5], 5, "before")).toBe(4)
    expect(gridDrop(groups, [0, 4], 4, "before")).toBeNull()
  })

  it("ignores a drop where the slides remain in the same group and place", () => {
    expect(gridDrop(groups, [1], 1, "same")).toBeNull()
    expect(gridDrop(groups, [1, 2], 3, "same")).toBeNull()
    expect(gridDrop(groups, [5, 6, 7], 5, "keep")).toBeNull()
    expect(gridDrop(groups, [5, 6, 7], 8, "keep")).toBeNull()
    expect(gridDrop(groups, [4], 5, "new")).toBeNull()
  })

  it("lands a group together at its position in the new slide groups", () => {
    expect(gridDrop(groups, [5, 6, 7], 4, "keep")).toBe(4)
    expect(gridDrop(groups, [2, 0], 7, "same")).toBe(5)
    expect(gridDrop(groups, [5, 0], 7, "new")).toBe(6)
  })
})

describe("live moves inside a slide group", () => {
  const groups = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ]

  it("moves the siblings aside for any slot of the dragged slide's own group, its first slot included", () => {
    expect(liveTarget(groups, 2, 0, 0)).toBe(0)
    expect(liveTarget(groups, 6, 4, 4)).toBe(4)
    expect(liveTarget(groups, 0, 2, 3)).toBe(2)
  })

  it("keeps the slides still for another group, its own group end, or the end of the group above", () => {
    expect(liveTarget(groups, 6, 0, 0)).toBeNull()
    expect(liveTarget(groups, 1, 3, 4)).toBeNull()
    expect(liveTarget(groups, 5, 3, 4)).toBeNull()
    expect(liveTarget(groups, 2, 2, 2)).toBeNull()
  })
})

describe("drop side", () => {
  const groups = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ]

  it("drops at a group start before its first slide", () => {
    expect(dropAt(groups, [6], 4, 4)).toEqual({ at: 4, side: "before" })
    expect(dropAt(groups, [6], 4, 5)).toEqual({ at: 5, side: "same" })
  })

  it("drops before a group only at its first slide, including when that group wraps", () => {
    const wrapped = [{ start: 0, end: 28 }]
    expect(dropAt(wrapped, [20], 0, 0)).toEqual({ at: 0, side: "before" })
    expect(dropAt(wrapped, [20], 10, 10)).toEqual({ at: 10, side: "same" })
    expect(dropAt(wrapped, [20], 20, 21)).toEqual({ at: 21, side: "same" })
    expect(liveTarget(wrapped, 2, 20, 21)).toBe(20)
  })

  it("keeps a slide group's first slide in its group when it is dropped on its own right half", () => {
    expect(dropAt(groups, [4], 4, 5)).toEqual({ at: 4, side: "before" })
    expect(gridDrop(groups, [4], 4, "before")).toBeNull()
    expect(dropAt(groups, [4, 1], 4, 5)).toEqual({ at: 4, side: "before" })
    expect(gridDrop(groups, [4, 1], 4, "before")).toBe(3)
  })
})

describe("whole slide group drops", () => {
  const bands = [
    { start: 0, end: 3, top: 100, bottom: 400, width: 900, wrapped: false },
    { start: 3, end: 8, top: 600, bottom: 900, width: 900, wrapped: true },
  ]
  const scale = 0.5
  const outside = terminalGroupBand / 2 / scale

  it("puts the bar above the first slide group's numbers, clear of them by half the drop band", () => {
    expect(groupDrop(bands, 60, scale)).toEqual({ at: 0, top: 100 - outside })
  })

  it("puts the bar below the last slide group's slides, clear of them by half the drop band", () => {
    expect(groupDrop(bands, 950, scale)).toEqual({ at: 8, top: 900 + outside })
  })

  it("puts the bar midway between two slide groups", () => {
    expect(groupDrop(bands, 500, scale)).toEqual({ at: 3, top: 500 })
  })

  it("drops nowhere over a group or far from the slide groups", () => {
    expect(groupDrop(bands, 200, scale)).toBeNull()
    expect(groupDrop(bands, 100 - 2 * outside - 1, scale)).toBeNull()
    expect(groupDrop(bands, 900 + 2 * outside + 1, scale)).toBeNull()
  })
})

describe("move to a new group below", () => {
  const groups = [
    { start: 0, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 8 },
  ]

  it("starts a new group after the slide's slide group", () => {
    expect(moveBelowPlace(groups, [1], 1)).toBe(4)
    expect(moveBelowPlace(groups, [5, 6], 5)).toBe(8)
  })

  it("offers nothing when the slides already make up their group alone", () => {
    expect(moveBelowPlace(groups, [4], 4)).toBeNull()
    expect(moveBelowPlace(groups, [5, 6, 7], 6)).toBeNull()
  })
})

describe("slide groups from the layout", () => {
  const ids = (from: number, count: number) =>
    Array.from({ length: count }, (_, at) => nodeId(`s:${String(from + at)}`))

  it("reads each slide group's range and its band from the top of its first slide to the bottom of its last", () => {
    const layout = gridLayout([ids(0, 3), ids(3, 12)], { width: 1920, height: 1080 })
    expect(gridRanges(layout)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 15 },
    ])
    const [first, second] = gridBands(layout)
    const right = (card: number) => layout.cards[card]!.left + 1920
    expect(first).toMatchObject({
      top: layout.cards[0]!.top,
      bottom: layout.cards[0]!.top + 1080,
      width: right(2),
      wrapped: false,
    })
    expect(second).toMatchObject({
      top: layout.cards[3]!.top,
      bottom: layout.cards[14]!.top + 1080,
      width: Math.max(...layout.cards.slice(3).map((card) => card.left + 1920)),
      wrapped: true,
    })
  })
})

describe("panning while a whole slide group is dragged", () => {
  it("stops panning once the first group's top or the last group's bottom is half the drop band past the pointer", () => {
    const clearance = terminalGroupBand / 2
    expect(groupPan(20, 100, 200, 900)).toBe(0)
    expect(groupPan(20, 100, 100 + clearance - 5, 900)).toBe(5)
    expect(groupPan(20, 100, 50, 900)).toBe(20)
    expect(groupPan(-20, 900, 100, 800)).toBe(0)
    expect(groupPan(-20, 900, 100, 1000)).toBe(-20)
    expect(groupPan(-20, 900, 100, 900 - clearance + 5)).toBe(-5)
  })
})
