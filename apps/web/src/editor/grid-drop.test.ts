import { describe, expect, it } from "vitest"
import { dragMoves, dropPlace, dropTarget, edgePan, landing, previewSlot, slotUnder } from "@/editor/grid-drop"

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

  it("finds the slot under the pointer, counting half of each gap to its nearer slide", () => {
    expect(slotUnder(150, 80, slots)?.index).toBe(0)
    expect(slotUnder(310, 80, slots)?.index).toBe(0)
    expect(slotUnder(322, 80, slots)?.index).toBe(1)
    expect(slotUnder(150, 400, slots)).toBeUndefined()
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

describe("dropping several slides", () => {
  function moved(count: number, held: readonly number[], at: number): number[] {
    const deck = Array.from({ length: count }, (_, index) => index)
    for (const { from, to } of dragMoves(held, at, count)) {
      const [slide] = deck.splice(from, 1)
      if (slide !== undefined) deck.splice(to, 0, slide)
    }
    return deck
  }

  it("lands the held slides together, in deck order, at the place they were dropped", () => {
    expect(moved(6, [4, 1], 0)).toEqual([1, 4, 0, 2, 3, 5])
    expect(moved(6, [1, 4], 3)).toEqual([0, 2, 1, 4, 3, 5])
    expect(moved(6, [1, 4], 6)).toEqual([0, 2, 3, 5, 1, 4])
    expect(moved(8, [1, 3], 6)).toEqual([0, 2, 4, 5, 1, 3, 6, 7])
  })

  it("moves one slide the way a single drop always has", () => {
    expect(dragMoves([0], 3, 4)).toEqual([{ from: 0, to: 2 }])
    expect(dragMoves([3], 0, 4)).toEqual([{ from: 3, to: 0 }])
    expect(dragMoves([2], 2, 4)).toEqual([])
    expect(dragMoves([2], 3, 4)).toEqual([])
  })

  it("sends nothing when the held slides already sit at the drop place", () => {
    expect(dragMoves([1, 2], 2, 5)).toEqual([])
    expect(dragMoves([3, 4], 5, 5)).toEqual([])
  })

  it("names the position the first held slide lands at", () => {
    expect(landing([1, 4], 3)).toBe(2)
    expect(landing([1, 4], 6)).toBe(4)
    expect(landing([4, 1], 0)).toBe(0)
  })
})
