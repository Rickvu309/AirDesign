import { describe, expect, it } from "vitest"
import { slideTurnSaid, type SlideTurn } from "@/editor/slide-said"

function turn(over: Partial<SlideTurn> = {}): SlideTurn {
  return { before: -1, after: -1, count: 2, held: 0, ...over }
}

describe("slideTurnSaid", () => {
  it("says the slide that remains when a new slide is undone", () => {
    expect(slideTurnSaid("undo", "new", turn({ before: 1, after: -1, count: 1, held: 1 }))).toBe("Slide 1 of 1")
  })

  it("says the slide was added when that new slide is redone", () => {
    expect(slideTurnSaid("redo", "new", turn({ before: -1, after: 1, count: 2, held: 0 }))).toBe("Added slide 2")
  })

  it("says the slide that remains when a duplicate is undone", () => {
    expect(slideTurnSaid("undo", "duplicate", turn({ before: 3, after: -1, count: 3, held: 3 }))).toBe("Slide 3 of 3")
  })

  it("says which slide was duplicated when that copy is redone", () => {
    expect(slideTurnSaid("redo", "duplicate", turn({ before: -1, after: 3, count: 4, held: 2 }))).toBe(
      "Duplicated slide 3. The copy is slide 4",
    )
  })

  it("says the restored slide when a delete is undone", () => {
    expect(slideTurnSaid("undo", "delete", turn({ before: -1, after: 1, count: 2, held: 0 }))).toBe("Slide 2 of 2")
  })

  it("says the slide was deleted when that delete is redone", () => {
    expect(slideTurnSaid("redo", "delete", turn({ before: 1, after: -1, count: 1, held: 1 }))).toBe(
      "Deleted slide 2. Press Control+Z to undo",
    )
  })

  it("says where a slide moved when that move is undone or redone", () => {
    expect(slideTurnSaid("undo", "order", turn({ before: 2, after: 1, count: 4, held: 2 }))).toBe(
      "Moved slide 3 to position 2",
    )
    expect(slideTurnSaid("redo", "order", turn({ before: 1, after: 2, count: 4, held: 1 }))).toBe(
      "Moved slide 2 to position 3",
    )
  })

  it("says nothing for an element edit, a move that did not change position, or an empty deck", () => {
    expect(slideTurnSaid("undo", "delete-element", turn({ before: 0, after: 0, count: 1, held: 0 }))).toBeNull()
    expect(slideTurnSaid("undo", "text", turn())).toBeNull()
    expect(slideTurnSaid("redo", "add-box", turn({ after: 0 }))).toBeNull()
    expect(slideTurnSaid("undo", "order", turn({ before: 1, after: 1, count: 3, held: 1 }))).toBeNull()
    expect(slideTurnSaid("undo", "new", turn({ before: 0, after: -1, count: 0, held: 0 }))).toBeNull()
  })
})
