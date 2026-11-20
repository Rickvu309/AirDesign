import { expect, it } from "vitest"
import { placedText } from "./text-placing.js"
import type { SnapTargets } from "./snapping.js"

const slideWidth = 12_192_000
const card = { left: 4_572_000, top: 3_000_000, right: 6_000_000, bottom: 4_000_000 }
const targets: SnapTargets = { layers: [card], slide: { left: 0, top: 0, right: slideWidth, bottom: 6_858_000 } }

it("places a click as a point and a drag past three pixels as the box it framed, in slide units", () => {
  const click = { from: { x: 120, y: 60 }, to: { x: 121, y: 61 }, shown: 960, free: false }
  expect(placedText(click, slideWidth, targets)).toEqual({ place: { x: 1_524_000, y: 762_000 }, guides: [] })
  const drag = { from: { x: 480, y: 270 }, to: { x: 120, y: 60 }, shown: 960, free: false }
  expect(placedText(drag, slideWidth, targets).place).toEqual({
    x: 1_524_000,
    y: 762_000,
    cx: 4_572_000,
    cy: 2_667_000,
  })
})

it("snaps a drawn box onto a layer's edge within 4.5 screen pixels, and not while Control is held", () => {
  const nearEdge = { from: { x: 100, y: 100 }, to: { x: 362, y: 200 }, shown: 960, free: false }
  const snapped = placedText(nearEdge, slideWidth, targets)
  expect(snapped.place.x + (snapped.place.cx ?? 0)).toBe(card.left)
  expect(snapped.guides.length).toBeGreaterThan(0)
  const held = placedText({ ...nearEdge, free: true }, slideWidth, targets)
  expect(held.place.x + (held.place.cx ?? 0)).toBe(4_597_400)
  expect(held.guides).toEqual([])
})

it("leaves a click where it lands, even beside a layer's edge", () => {
  const click = { from: { x: 362, y: 100 }, to: { x: 362, y: 100 }, shown: 960, free: false }
  expect(placedText(click, slideWidth, targets).place.x).toBe(4_597_400)
})
