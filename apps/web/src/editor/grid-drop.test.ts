import { describe, expect, it } from "vitest"
import { dropPlace, dropTarget, edgeScroll } from "@/editor/grid-drop"

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
