import { describe, expect, it } from "vitest"
import { slideGlides } from "@/editor/slide-list-glide"

describe("slide list glide", () => {
  it("counts the rows each kept slide travelled and marks a slide that arrived", () => {
    expect(slideGlides(["a", "b", "c"], ["c", "a", "b"])).toEqual([2, -1, -1])
    expect(slideGlides(["a", "b", "c"], ["a", "n", "b", "c"])).toEqual([0, "new", -1, -1])
    expect(slideGlides(["a", "b", "c"], ["a", "c"])).toEqual([0, 1])
  })

  it("leaves a deck that opens or is replaced where it is", () => {
    expect(slideGlides([], ["a", "b"])).toBeNull()
    expect(slideGlides(["a", "b"], ["x", "y"])).toBeNull()
    expect(slideGlides(["a", "b"], ["a", "b"])).toBeNull()
  })
})
