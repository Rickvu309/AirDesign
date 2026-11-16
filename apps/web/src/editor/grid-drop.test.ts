import { describe, expect, it } from "vitest"
import { dropPlace, dropTarget, edgeScroll, previewSlot, slotUnder } from "@/editor/grid-drop"

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

  it("scrolls the list near its top and bottom edges, faster the closer the pointer", () => {
    const list = { top: 100, height: 600 }
    expect(edgeScroll(400, list)).toBe(0)
    expect(edgeScroll(110, list)).toBeLessThan(0)
    expect(edgeScroll(690, list)).toBeGreaterThan(0)
    expect(Math.abs(edgeScroll(101, list))).toBeGreaterThan(Math.abs(edgeScroll(150, list)))
    expect(edgeScroll(160, list)).toBe(0)
  })
})

describe("drag preview", () => {
  const slots = [0, 1, 2, 3, 4].map((index) => ({ index, left: index * 332, top: 0, width: 300, height: 169 }))

  it("shows each slide at the slot it takes after the move, and leaves the others where they are", () => {
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 1, 3))).toEqual([0, 3, 1, 2, 4])
    expect([0, 1, 2, 3, 4].map((index) => previewSlot(index, 3, 0))).toEqual([1, 2, 3, 0, 4])
    expect([0, 1, 2].map((index) => previewSlot(index, 1, null))).toEqual([0, 1, 2])
  })

  it("finds the slot under the pointer, counting half of each gap to its nearer slide", () => {
    expect(slotUnder(150, 80, slots)?.index).toBe(0)
    expect(slotUnder(310, 80, slots)?.index).toBe(0)
    expect(slotUnder(322, 80, slots)?.index).toBe(1)
    expect(slotUnder(150, 400, slots)).toBeUndefined()
  })
})
