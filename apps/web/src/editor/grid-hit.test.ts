import { describe, expect, it } from "vitest"
import { gridHit, gridPress, type GridHit } from "@/editor/grid-hit"

describe("grid hit", () => {
  const text = { key: "text", box: { left: 20, top: 40, right: 120, bottom: 90 } }

  it("finds the frontmost element under the pointer and nothing on a blank area", () => {
    expect(gridHit([text], 50, 60)).toBe("text")
    expect(gridHit([text], 10, 60)).toBeNull()
    expect(gridHit([text], 50, 95)).toBeNull()
    expect(gridHit([text, { ...text, key: "front" }], 50, 60)).toBe("front")
  })
})

describe("grid press", () => {
  const cases: readonly [GridHit, boolean, boolean, ReturnType<typeof gridPress>][] = [
    ["number", false, false, "slide"],
    ["number", true, false, "slide"],
    ["number", false, true, "slide"],
    ["blank", false, false, "slide"],
    ["blank", false, true, "slide"],
    ["element", false, false, "element"],
    ["element", false, true, "element"],
    ["blank", true, false, "slide"],
    ["blank", true, true, "slide"],
    ["element", true, false, "editor"],
    ["element", true, true, "editor"],
    ["text", true, false, "element"],
    ["text", true, true, "editor"],
    ["typing", true, false, "editor"],
    ["typing", true, true, "editor"],
  ]

  for (const [hit, active, modified, press] of cases) {
    it(`a ${modified ? "modified " : ""}press on ${hit} of ${active ? "the live slide" : "a thumbnail"} goes to ${press}`, () => {
      expect(gridPress(hit, active, modified)).toBe(press)
    })
  }

  it("treats every part of an unreadable slide as the slide, open or closed", () => {
    for (const active of [false, true])
      for (const modified of [false, true])
        for (const hit of ["number", "blank", "element", "text", "typing"] as const)
          expect(gridPress(hit, active, modified, true)).toBe("slide")
  })

  it("treats a thumbnail too small to show its number as one whole slide, so it still selects and reorders", () => {
    for (const modified of [false, true]) expect(gridPress("element", false, modified, true)).toBe("slide")
    expect(gridPress("element", false, false, false)).toBe("element")
    expect(gridPress("text", true, false, true)).toBe("slide")
    expect(gridPress("blank", true, false, true)).toBe("slide")
  })

  it("leaves every press that starts on a number or a blank thumbnail to the slide's click and reorder drag", () => {
    for (const modified of [false, true]) {
      expect(gridPress("number", false, modified)).toBe("slide")
      expect(gridPress("blank", false, modified)).toBe("slide")
    }
  })
})
