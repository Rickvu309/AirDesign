import { describe, expect, it } from "vitest"
import { measured } from "./distances.js"
import type { Bounds } from "./snapping.js"

function box(left: number, top: number, right: number, bottom: number): Bounds {
  return { left, top, right, bottom }
}

const selected = box(100, 100, 200, 200)

describe("measured", () => {
  it("measures the gap to a layer beside it, at the middle of what they share", () => {
    const target = box(260, 120, 360, 180)
    expect(measured(selected, target)).toEqual([
      { kind: "outline", box: target },
      { kind: "distance", axis: "x", from: 200, to: 260, across: 150 },
    ])
  })

  it("measures the gap to a layer below it, across the part they share", () => {
    const target = box(150, 300, 250, 400)
    expect(measured(selected, target)).toEqual([
      { kind: "outline", box: target },
      { kind: "distance", axis: "y", from: 200, to: 300, across: 175 },
    ])
  })

  it("measures both gaps to a layer off its corner, with a dashed line out to each", () => {
    const target = box(300, 300, 400, 350)
    expect(measured(selected, target)).toEqual([
      { kind: "outline", box: target },
      { kind: "distance", axis: "x", from: 200, to: 300, across: 150 },
      { kind: "extension", axis: "y", at: 300, from: 150, to: 300 },
      { kind: "distance", axis: "y", from: 200, to: 300, across: 150 },
      { kind: "extension", axis: "x", at: 300, from: 150, to: 300 },
    ])
  })

  it("measures out to each edge of the slide it sits in, along its centre lines", () => {
    const slide = box(0, 0, 1000, 500)
    expect(measured(selected, slide)).toEqual([
      { kind: "outline", box: slide },
      { kind: "distance", axis: "x", from: 0, to: 100, across: 150 },
      { kind: "distance", axis: "x", from: 200, to: 1000, across: 150 },
      { kind: "distance", axis: "y", from: 0, to: 100, across: 150 },
      { kind: "distance", axis: "y", from: 200, to: 500, across: 150 },
    ])
  })

  it("measures in from a layer it holds, and skips edges that line up", () => {
    const inner = box(100, 120, 150, 160)
    expect(measured(selected, inner)).toEqual([
      { kind: "outline", box: inner },
      { kind: "distance", axis: "x", from: 150, to: 200, across: 140 },
      { kind: "distance", axis: "y", from: 100, to: 120, across: 125 },
      { kind: "distance", axis: "y", from: 160, to: 200, across: 125 },
    ])
  })
})
