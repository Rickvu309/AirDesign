import { expect, it } from "vitest"
import { keptCorners } from "./kept-corners.js"

const card = { cx: 2_000_000, cy: 1_000_000 }

it("keeps a rounded rectangle's corner radius when its short side changes", () => {
  expect(keptCorners("roundRect", { adj: 20_000 }, card, { cx: 2_000_000, cy: 2_000_000 })).toEqual({ adj: 10_000 })
  expect(keptCorners("roundRect", { adj: 20_000 }, card, { cx: 3_000_000, cy: 500_000 })).toEqual({ adj: 40_000 })
})

it("reads a missing adjust as PowerPoint's default", () => {
  expect(keptCorners("roundRect", {}, card, { cx: 2_000_000, cy: 2_000_000 })).toEqual({ adj: 8_334 })
  expect(keptCorners("round1Rect", {}, card, { cx: 2_000_000, cy: 2_000_000 })).toEqual({ adj: 8_334 })
  expect(keptCorners("round2SameRect", { adj2: 10_000 }, card, { cx: 2_000_000, cy: 2_000_000 })).toEqual({
    adj1: 8_334,
    adj2: 5_000,
  })
})

it("keeps the radius past half the short side, so growing back restores it", () => {
  const small = keptCorners("roundRect", { adj: 40_000 }, card, { cx: 2_000_000, cy: 400_000 })
  expect(small).toEqual({ adj: 100_000 })
  expect(keptCorners("roundRect", small ?? {}, { cx: 2_000_000, cy: 400_000 }, card)).toEqual({ adj: 40_000 })
})

it("changes nothing when the short side stays, the box is empty or the shape has no corners", () => {
  expect(keptCorners("roundRect", { adj: 20_000 }, card, { cx: 4_000_000, cy: 1_000_000 })).toBeNull()
  expect(keptCorners("roundRect", { adj: 20_000 }, card, { cx: 0, cy: 1_000_000 })).toBeNull()
  expect(keptCorners("roundRect", { adj: 20_000 }, { cx: 0, cy: 0 }, card)).toBeNull()
  for (const preset of ["rect", "ellipse", "chevron", "snip1Rect", "custom"])
    expect(keptCorners(preset, { adj: 20_000 }, card, { cx: 2_000_000, cy: 2_000_000 })).toBeNull()
})
