import { describe, expect, it } from "vitest"
import { gridElementPresses } from "@/editor/grid-number"
import { gridRoute, type GridPart } from "@/editor/grid-hit"

const parts = ["number", "live", "picture"] as const satisfies readonly GridPart[]

describe("grid route", () => {
  it("keeps a press on the number, or on a slide too small to edit, on the slide", () => {
    for (const part of parts) for (const element of [false, true]) expect(gridRoute(part, element, true)).toBe("slide")
    for (const element of [false, true]) expect(gridRoute("number", element, false)).toBe("slide")
  })

  it("leaves a press on the live canvas to the canvas", () => {
    expect(gridRoute("live", false, false)).toBe("canvas")
    expect(gridRoute("live", true, false)).toBe("canvas")
  })

  it("edits when the picture holds a layer and picks the slide when it does not", () => {
    expect(gridRoute("picture", true, false)).toBe("edit")
    expect(gridRoute("picture", false, false)).toBe("slide")
  })
})

it.each([
  [87.99, 112, "slide"],
  [88, 27.99, "slide"],
  [88, 28, "edit"],
  [400, 111.99, "edit"],
  [400, 112, "edit"],
])("routes a layer under the pointer at width %s and gap %s to %s", (width, gap, route) => {
  expect(gridRoute("picture", true, !gridElementPresses({ width, gap }))).toBe(route)
})
