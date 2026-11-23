import { describe, expect, it } from "vitest"
import { gridDrop } from "@/editor/grid-drop"

describe("moving slides between slide groups", () => {
  const groups = [
    { start: 0, end: 4 },
    { start: 4, end: 5 },
    { start: 5, end: 8 },
  ]

  it("accepts a drop that changes groups without changing slide order", () => {
    expect(gridDrop(groups, [5], 5)).toBe(5)
    expect(gridDrop(groups, [5, 6], 5)).toBe(5)
    expect(gridDrop(groups, [5, 6, 7], 5)).toBe(5)
  })

  it("ignores a drop where the slides remain in the same group and place", () => {
    expect(gridDrop(groups, [3], 4)).toBeNull()
    expect(gridDrop(groups, [1], 1)).toBeNull()
    expect(gridDrop(groups, [1, 2], 3)).toBeNull()
  })

  it("lands the held slides together after the last slide before the drop", () => {
    expect(gridDrop(groups, [2, 0], 7)).toBe(5)
  })
})
