import { describe, expect, it } from "vitest"
import {
  dropAt,
  dropPlace,
  dropTarget,
  edgePan,
  gridDrop,
  gridDropBoundary,
  liveTarget,
  moveBelowPlace,
  previewSlot,
  rowDrop,
  slotUnder,
  terminalRowBand,
} from "@/editor/grid-drop"

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
  const slots = [0, 1, 2, 3, 4].map((index) => ({ index, left: index * 332, top: 0, width: 300, height: 169 }))

  it("shows each slide at the slot it takes after the move, and leaves the others where they are", () => {
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 1, 3))).toEqual([0, 3, 1, 2, 4])
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 3, 0))).toEqual([1, 2, 3, 0, 4])
    expect([0, 1, 2].map((index) => previewSlot(index, 1, null))).toEqual([0, 1, 2])
  })

  const rows = [{ start: 0, end: 5 }]

  it("finds the slot under the pointer, counting half of each gap to its nearer slide", () => {
    expect(slotUnder(150, 80, slots, rows)?.index).toBe(0)
    expect(slotUnder(310, 80, slots, rows)?.index).toBe(0)
    expect(slotUnder(322, 80, slots, rows)?.index).toBe(1)
    expect(slotUnder(150, 400, slots, rows)).toBeUndefined()
  })

  it("extends a row end through its gap and leaves the distant canvas empty", () => {
    const right = 4 * 332 + 300
    expect(slotUnder(right + 20, 80, slots, rows)?.index).toBe(4)
    expect(slotUnder(right + 40, 80, slots, rows)).toBeUndefined()
  })
})

describe("edge pan", () => {
  const room = { left: 100, top: 200, width: 800, height: 400 }

  it("pans toward each edge of the canvas the pointer is near, faster the closer it is", () => {
    expect(edgePan({ x: 102, y: 400 }, room)).toEqual({ x: expect.any(Number) as number, y: 0 })
    expect(edgePan({ x: 102, y: 400 }, room).x).toBeGreaterThan(0)
    expect(edgePan({ x: 898, y: 400 }, room).x).toBeLessThan(0)
    expect(edgePan({ x: 500, y: 202 }, room).y).toBeGreaterThan(0)
    expect(edgePan({ x: 500, y: 598 }, room).y).toBeLessThan(0)
    expect(edgePan({ x: 102, y: 400 }, room).x).toBeGreaterThan(edgePan({ x: 140, y: 400 }, room).x)
    expect(edgePan({ x: 898, y: 598 }, room)).toEqual({
      x: edgePan({ x: 898, y: 400 }, room).x,
      y: edgePan({ x: 500, y: 598 }, room).y,
    })
  })

  it("stays still in the middle of the canvas and anywhere outside it", () => {
    expect(edgePan({ x: 500, y: 400 }, room)).toEqual({ x: 0, y: 0 })
    expect(edgePan({ x: 99, y: 400 }, room)).toEqual({ x: 0, y: 0 })
    expect(edgePan({ x: 901, y: 400 }, room)).toEqual({ x: 0, y: 0 })
    expect(edgePan({ x: 500, y: 199 }, room)).toEqual({ x: 0, y: 0 })
    expect(edgePan({ x: 500, y: 601 }, room)).toEqual({ x: 0, y: 0 })
  })
})

describe("moving slides between rows", () => {
  const rows = [
    { start: 0, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 8 },
  ]

  it("accepts a drop that changes rows without changing slide order", () => {
    expect(gridDrop(rows, [5], 5, "same")).toBe(5)
    expect(gridDrop(rows, [5, 6], 5, "same")).toBe(5)
    expect(gridDrop(rows, [5, 6, 7], 5, "same")).toBe(5)
    expect(gridDrop(rows, [3], 4, "new")).toBe(3)
  })

  it("distinguishes a row start from the previous row end at the same position", () => {
    expect(gridDrop(rows, [3], 4, "same")).toBeNull()
    expect(gridDrop(rows, [3], 4, "before")).toBe(3)
    expect(gridDrop(rows, [3, 4], 5, "before")).toBe(3)
    expect(gridDrop(rows, [5, 6], 0, "before")).toBe(0)
  })

  it("uses the first unheld slide in the destination row as the anchor", () => {
    expect(gridDrop(rows, [0, 5], 5, "before")).toBe(4)
    expect(gridDrop(rows, [0, 4], 4, "before")).toBeNull()
  })

  it("ignores a drop where the slides remain in the same row and place", () => {
    expect(gridDrop(rows, [1], 1, "same")).toBeNull()
    expect(gridDrop(rows, [1, 2], 3, "same")).toBeNull()
    expect(gridDrop(rows, [5, 6, 7], 5, "keep")).toBeNull()
    expect(gridDrop(rows, [5, 6, 7], 8, "keep")).toBeNull()
    expect(gridDrop(rows, [4], 5, "new")).toBeNull()
  })

  it("lands a group together at its position in the new rows", () => {
    expect(gridDrop(rows, [5, 6, 7], 4, "keep")).toBe(4)
    expect(gridDrop(rows, [2, 0], 7, "same")).toBe(5)
    expect(gridDrop(rows, [5, 0], 7, "new")).toBe(6)
  })
})

describe("live moves inside a row", () => {
  const rows = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ]

  it("moves the siblings aside for any slot of the dragged slide's own row, its first slot included", () => {
    expect(liveTarget(rows, 2, 0, 0)).toBe(0)
    expect(liveTarget(rows, 6, 4, 4)).toBe(4)
    expect(liveTarget(rows, 0, 2, 3)).toBe(2)
  })

  it("keeps the slides still for another row, its own row end, or the end of the row above", () => {
    expect(liveTarget(rows, 6, 0, 0)).toBeNull()
    expect(liveTarget(rows, 1, 3, 4)).toBeNull()
    expect(liveTarget(rows, 5, 3, 4)).toBeNull()
    expect(liveTarget(rows, 2, 2, 2)).toBeNull()
  })
})

describe("drop side", () => {
  const rows = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ]

  it("drops at a row start before its first slide", () => {
    expect(dropAt(rows, [6], 4, 4)).toEqual({ at: 4, side: "before" })
    expect(dropAt(rows, [6], 4, 5)).toEqual({ at: 5, side: "same" })
  })

  it("drops before a group only at its first slide, including when that group wraps", () => {
    const wrapped = [{ start: 0, end: 28 }]
    expect(dropAt(wrapped, [20], 0, 0)).toEqual({ at: 0, side: "before" })
    expect(dropAt(wrapped, [20], 10, 10)).toEqual({ at: 10, side: "same" })
    expect(dropAt(wrapped, [20], 20, 21)).toEqual({ at: 21, side: "same" })
    expect(liveTarget(wrapped, 2, 20, 21)).toBe(20)
  })

  it("keeps a row's first slide in its row when it is dropped on its own right half", () => {
    expect(dropAt(rows, [4], 4, 5)).toEqual({ at: 4, side: "before" })
    expect(gridDrop(rows, [4], 4, "before")).toBeNull()
    expect(dropAt(rows, [4, 1], 4, 5)).toEqual({ at: 4, side: "before" })
    expect(gridDrop(rows, [4, 1], 4, "before")).toBe(3)
  })
})

describe("whole-row drops", () => {
  const bands = [
    { start: 0, end: 3, top: 100, bottom: 400 },
    { start: 3, end: 8, top: 600, bottom: 900 },
  ]
  const scale = 0.5
  const outside = terminalRowBand / 2 / scale

  it("puts the bar above the first row's numbers, clear of them by half the drop band", () => {
    expect(rowDrop(bands, 60, scale)).toEqual({ at: 0, top: 100 - outside })
  })

  it("puts the bar below the last row's slides, clear of them by half the drop band", () => {
    expect(rowDrop(bands, 950, scale)).toEqual({ at: 8, top: 900 + outside })
  })

  it("puts the bar midway between two rows", () => {
    expect(rowDrop(bands, 500, scale)).toEqual({ at: 3, top: 500 })
  })

  it("drops nowhere over a row or far from the rows", () => {
    expect(rowDrop(bands, 200, scale)).toBeNull()
    expect(rowDrop(bands, 100 - 2 * outside - 1, scale)).toBeNull()
    expect(rowDrop(bands, 900 + 2 * outside + 1, scale)).toBeNull()
  })
})

describe("move to a new row below", () => {
  const rows = [
    { start: 0, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 8 },
  ]

  it("starts a new row after the slide's row", () => {
    expect(moveBelowPlace(rows, [1], 1)).toBe(4)
    expect(moveBelowPlace(rows, [5, 6], 5)).toBe(8)
  })

  it("offers nothing when the slides already make up their row alone", () => {
    expect(moveBelowPlace(rows, [4], 4)).toBeNull()
    expect(moveBelowPlace(rows, [5, 6, 7], 6)).toBeNull()
  })
})

it("uses the whole collapsed section as the boundary of a drop", () => {
  const collapsed = [{ start: 2, end: 8 }]
  expect(gridDropBoundary(collapsed, { at: 4, side: "same" }, 0)).toEqual({ at: 8, side: "new" })
  expect(gridDropBoundary(collapsed, { at: 4, side: "keep" }, 9)).toEqual({ at: 2, side: "keep" })
  expect(gridDropBoundary(collapsed, { at: 8, side: "same" }, 0)).toEqual({ at: 8, side: "new" })
  expect(gridDropBoundary(collapsed, { at: 1, side: "same" }, 0)).toEqual({ at: 1, side: "same" })
})
