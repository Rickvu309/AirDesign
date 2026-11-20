import { expect, it } from "vitest"
import type { Box } from "./box.js"
import { placeChart } from "./chart-placement.js"
import { elementId } from "./index.js"

const slide = { width: 12_192_000, height: 6_858_000 }
const half = { cx: 6_096_000, cy: 3_429_000 }

function overlaps(left: Box, right: Box): boolean {
  return (
    left.x < right.x + right.cx &&
    right.x < left.x + left.cx &&
    left.y < right.y + right.cy &&
    right.y < left.y + left.cy
  )
}

function inside(box: Box): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.cx <= slide.width && box.y + box.cy <= slide.height
}

it("centres the first chart on an empty slide and moves nothing", () => {
  const placed = placeChart(slide, [], [], half)
  expect(placed.box).toEqual({ x: 3_048_000, y: 1_714_500, ...half })
  expect(placed.moved).toBeNull()
})

it("splits the slide with a centred first chart: two charts side by side, neither overlapping", () => {
  const first = { node: elementId("256.4"), box: { x: 3_048_000, y: 1_714_500, ...half } }
  const placed = placeChart(slide, [first.box], [first], half)
  expect(placed.moved?.node).toBe(elementId("256.4"))
  const moved = placed.moved?.box
  if (moved === undefined) throw new Error("moved")
  expect(overlaps(placed.box, moved)).toBe(false)
  expect([placed.box, moved].every(inside)).toBe(true)
  expect(moved.x).toBeLessThan(placed.box.x)
  expect(placed.box.cx).toBe(moved.cx)
  expect(placed.box.cy * half.cx).toBeCloseTo(placed.box.cx * half.cy, -6)
  expect(placed.box.y + placed.box.cy / 2).toBeCloseTo(moved.y + moved.cy / 2, -1)
})

it("takes the free half beside a chart that already sits on one side, and moves nothing", () => {
  const left = { node: elementId("256.4"), box: { x: 487_680, y: 1_714_500, cx: 5_400_000, cy: 3_429_000 } }
  const placed = placeChart(slide, [left.box], [left], half)
  expect(placed.moved).toBeNull()
  expect(overlaps(placed.box, left.box)).toBe(false)
  expect(inside(placed.box)).toBe(true)
})

it("does not move a chart when the split would land on other layers", () => {
  const first = { node: elementId("256.4"), box: { x: 3_048_000, y: 1_714_500, ...half } }
  const notes = { x: 300_000, y: 1_000_000, cx: 2_500_000, cy: 5_000_000 }
  const placed = placeChart(slide, [first.box, notes], [first], half)
  expect(placed.moved).toBeNull()
})

it("keeps clear of a caption that sits on the first chart when it splits", () => {
  const first = { node: elementId("256.4"), box: { x: 3_048_000, y: 1_714_500, ...half } }
  const caption = { x: 3_200_000, y: 5_300_000, cx: 5_000_000, cy: 400_000 }
  const placed = placeChart(slide, [first.box, caption], [first], half)
  if (placed.moved !== null) expect([placed.box, placed.moved.box].some((box) => overlaps(box, caption))).toBe(false)
})
