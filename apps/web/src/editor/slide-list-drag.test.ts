import { describe, expect, it } from "vitest"
import { dragOrder, dragPlace, dragTarget } from "@/editor/slide-list-drag"

describe("slide list drag", () => {
  it("lands one dragged slide on the row it is held over", () => {
    const drag = { count: 4, held: [2], grabbed: 2 }
    expect(dragOrder(drag, dragPlace(drag, 0))).toEqual([2, 0, 1, 3])
    expect(dragOrder(drag, dragPlace(drag, 3))).toEqual([0, 1, 3, 2])
    expect(dragOrder(drag, dragPlace(drag, 2))).toEqual([0, 1, 2, 3])
  })

  it("keeps a slide dragged past either end inside the list", () => {
    const drag = { count: 3, held: [1], grabbed: 1 }
    expect(dragPlace(drag, -4)).toBe(0)
    expect(dragPlace(drag, 9)).toBe(2)
  })

  it("gathers a held set around the slide in hand, in deck order", () => {
    const drag = { count: 6, held: [1, 4], grabbed: 4 }
    expect(dragOrder(drag, dragPlace(drag, 1))).toEqual([1, 4, 0, 2, 3, 5])
    expect(dragOrder(drag, dragPlace(drag, 5))).toEqual([0, 2, 3, 5, 1, 4])
    const first = { count: 4, held: [0, 1], grabbed: 0 }
    expect(dragOrder(first, dragPlace(first, 3))).toEqual([2, 3, 0, 1])
  })

  it("names the slide a held set lands before, or the end of the deck", () => {
    const drag = { count: 6, held: [1, 4], grabbed: 1 }
    expect(dragTarget(drag, 0)).toBe(0)
    expect(dragTarget(drag, 2)).toBe(3)
    expect(dragTarget(drag, 4)).toBe(6)
  })
})
