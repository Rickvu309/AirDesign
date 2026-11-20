import type { Guide } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { guideAt, guideDrop, snappedGuide } from "./guide-edit.js"

const slide = { left: 0, top: 0, right: 12_192_000, bottom: 6_858_000 }
const layer = { left: 1_000_000, top: 2_000_000, right: 3_000_000, bottom: 2_500_000 }
const guides: readonly Guide[] = [
  { axis: "x", offset: 500_000 },
  { axis: "y", offset: 700_000 },
]

describe("guideAt", () => {
  it("reads the pointer as whole EMU from the slide's edge", () => {
    expect(guideAt(130.5, 30, 0.0001)).toBe(1_005_000)
    expect(guideAt(10, 30, 0.0001)).toBe(-200_000)
  })
})

describe("snappedGuide", () => {
  it("lands on a layer's edge or centre, or the slide's, within reach", () => {
    expect(snappedGuide("x", 1_030_000, { layers: [layer], slide }, 45_000)).toBe(1_000_000)
    expect(snappedGuide("x", 2_020_000, { layers: [layer], slide }, 45_000)).toBe(2_000_000)
    expect(snappedGuide("y", 6_830_000, { layers: [layer], slide }, 45_000)).toBe(6_858_000)
    expect(snappedGuide("x", 1_100_000, { layers: [layer], slide }, 45_000)).toBe(1_100_000)
  })

  it("ignores other guides", () => {
    const targets = { layers: [], slide, guides: { x: [1_010_000], y: [] } }
    expect(snappedGuide("x", 1_000_000, targets, 45_000)).toBe(1_000_000)
  })
})

describe("guideDrop", () => {
  it("adds a new guide where it is let go", () => {
    expect(guideDrop(guides, { from: null, axis: "x", offset: 900_000, away: false })).toEqual({
      name: "add-guide",
      guides: [...guides, { axis: "x", offset: 900_000 }],
    })
  })

  it("adds nothing when a new guide is let go over its ruler or off the slide", () => {
    expect(guideDrop(guides, { from: null, axis: "x", offset: -10_000, away: true })).toBeNull()
  })

  it("moves a held guide, and removes it when it is let go over its ruler or off the slide", () => {
    expect(guideDrop(guides, { from: 1, axis: "y", offset: 800_000, away: false })).toEqual({
      name: "move-guide",
      guides: [guides[0], { axis: "y", offset: 800_000 }],
    })
    expect(guideDrop(guides, { from: 0, axis: "x", offset: -10_000, away: true })).toEqual({
      name: "delete-guide",
      guides: [guides[1]],
    })
  })

  it("changes nothing when a held guide lands where it was", () => {
    expect(guideDrop(guides, { from: 0, axis: "x", offset: 500_000, away: false })).toBeNull()
  })
})
