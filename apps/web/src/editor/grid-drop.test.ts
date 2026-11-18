import { describe, expect, it } from "vitest"
import { dropPlace, dropTarget, edgePan, gridDrop, previewSlot, slotUnder } from "@/editor/grid-drop"

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
