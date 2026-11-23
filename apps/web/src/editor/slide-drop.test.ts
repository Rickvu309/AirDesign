import { describe, expect, it } from "vitest"
import { droppedAt } from "@/editor/slide-drop"

describe("dropping held slides in the slide list", () => {
  it("ignores a drop that leaves every slide where it was, at any slide", () => {
    for (let at = 0; at < 9; at++) expect(droppedAt(9, [at], at)).toBeNull()
    expect(droppedAt(9, [3], 4)).toBeNull()
    expect(droppedAt(9, [4, 5, 6], 5)).toBeNull()
    expect(droppedAt(9, [], 3)).toBeNull()
  })

  it("lands the held slides together after the last slide before the drop", () => {
    expect(droppedAt(8, [2, 0], 7)).toBe(5)
    expect(droppedAt(8, [6], 0)).toBe(0)
    expect(droppedAt(8, [0], 8)).toBe(7)
  })
})
