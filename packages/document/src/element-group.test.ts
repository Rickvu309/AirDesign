import { describe, expect, it } from "vitest"
import { throughGroup } from "./index.js"

describe("element group", () => {
  it("turns and mirrors a child through a flipped, turned group as the painter does", () => {
    const frame = { x: 0, y: 0, cx: 200, cy: 100 }
    const child = { box: { x: 0, y: 0, cx: 100, cy: 100 }, rot: 0, flipH: false, flipV: false }
    const group = { box: frame, rot: 5_400_000, flipH: true, flipV: false }
    expect(throughGroup(child, group, frame)).toEqual({
      box: { x: 50, y: 50, cx: 100, cy: 100 },
      rot: 5_400_000,
      flipH: true,
      flipV: false,
    })
    expect(throughGroup(child, { ...group, rot: 0, flipH: false }, frame)).toEqual(child)
  })
})
