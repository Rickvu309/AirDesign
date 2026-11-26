import { describe, expect, it } from "vitest"
import { gridElementPresses } from "@/editor/grid-number"
import { gridPress, type GridHit } from "@/editor/grid-hit"

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

  it("treats a thumbnail too small to show its number as one whole slide", () => {
    for (const modified of [false, true]) expect(gridPress("element", false, modified, true)).toBe("slide")
    expect(gridPress("element", false, false, false)).toBe("element")
    expect(gridPress("text", true, false, true)).toBe("slide")
    expect(gridPress("blank", true, false, true)).toBe("slide")
  })

  it("leaves every press that starts on a number or a blank thumbnail to the slide", () => {
    for (const modified of [false, true]) {
      expect(gridPress("number", false, modified)).toBe("slide")
      expect(gridPress("blank", false, modified)).toBe("slide")
    }
  })
})

it.each([
  [87.99, 112, "slide"],
  [88, 27.99, "slide"],
  [88, 28, "element"],
  [400, 111.99, "element"],
  [400, 112, "element"],
])("routes element presses at width %s and gap %s to %s", (width, gap, pressed) => {
  expect(gridPress("element", false, false, !gridElementPresses({ width, gap }))).toBe(pressed)
})
