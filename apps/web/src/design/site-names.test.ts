import { siteCount } from "@airdesign/document"
import { expect, it } from "vitest"
import { siteNames } from "./site-names"

const box = { x: 0, y: 0, cx: 914_400, cy: 914_400 }

it("names a rectangle's four sites as the sides they sit on, in the order PowerPoint numbers them", () => {
  expect(siteNames({ preset: "rect", adjust: {} }, box)).toEqual(["Top", "Left", "Bottom", "Right"])
})

it("names an ellipse's eight sites by side and corner", () => {
  expect(siteNames({ preset: "ellipse", adjust: {} }, box)).toEqual([
    "Top",
    "Top left",
    "Left",
    "Bottom left",
    "Bottom",
    "Bottom right",
    "Right",
    "Top right",
  ])
})

it("names the middle of a slanted side by that side", () => {
  expect(siteNames({ preset: "triangle", adjust: {} }, box)).toEqual([
    "Top",
    "Left",
    "Bottom left",
    "Bottom",
    "Bottom right",
    "Right",
  ])
})

it("falls back to Point and its number for sites that share a name", () => {
  expect(siteNames({ preset: "parallelogram", adjust: {} }, box)).toEqual([
    "Point 1",
    "Point 2",
    "Right",
    "Point 4",
    "Point 5",
    "Left",
  ])
})

it("never gives two sites of one shape the same name", () => {
  for (const preset of ["rect", "ellipse", "triangle", "parallelogram", "hexagon", "star5", "rightArrow"] as const) {
    const names = siteNames({ preset, adjust: {} }, box)
    expect(names).toHaveLength(siteCount(preset))
    expect(new Set(names).size).toBe(names.length)
  }
})
