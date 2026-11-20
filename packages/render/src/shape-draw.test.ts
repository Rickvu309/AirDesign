import { expect, it } from "vitest"
import { drawnShape } from "./shape-draw.js"
import type { SnapTargets } from "./snapping.js"

const slide = { left: 0, top: 0, right: 12_192_000, bottom: 6_858_000 }
const none: SnapTargets = { layers: [], slide }
const card: SnapTargets = { layers: [{ left: 3_000_000, top: 1_000_000, right: 5_000_000, bottom: 2_000_000 }], slide }
const plain = { shift: false, alt: false, free: false }
const reach = 50_000

it("draws a box from the pressed corner to the pointer, whichever way the drag goes", () => {
  const drawn = drawnShape("box", { x: 2_000_000, y: 2_000_000 }, { x: 1_000_000, y: 3_000_000 }, plain, none, reach)
  expect(drawn.box).toEqual({ x: 1_000_000, y: 2_000_000, cx: 1_000_000, cy: 1_000_000, flipH: false, flipV: false })
})

it("keeps a box square with Shift, on the longer side of the drag", () => {
  const drawn = drawnShape(
    "box",
    { x: 1_000_000, y: 1_000_000 },
    { x: 2_000_000, y: 1_400_000 },
    { ...plain, shift: true },
    none,
    reach,
  )
  expect(drawn.box).toEqual({ x: 1_000_000, y: 1_000_000, cx: 1_000_000, cy: 1_000_000, flipH: false, flipV: false })
})

it("draws from the centre with Alt, and both together give a square around the press", () => {
  const from = { x: 4_000_000, y: 3_000_000 }
  const to = { x: 4_500_000, y: 3_200_000 }
  expect(drawnShape("box", from, to, { ...plain, alt: true }, none, reach).box).toEqual({
    x: 3_500_000,
    y: 2_800_000,
    cx: 1_000_000,
    cy: 400_000,
    flipH: false,
    flipV: false,
  })
  expect(drawnShape("box", from, to, { ...plain, alt: true, shift: true }, none, reach).box).toEqual({
    x: 3_500_000,
    y: 2_500_000,
    cx: 1_000_000,
    cy: 1_000_000,
    flipH: false,
    flipV: false,
  })
})

it("snaps the dragged corner to another layer's edge and shows the guide; Ctrl draws free", () => {
  const snapped = drawnShape("box", { x: 1_000_000, y: 1_500_000 }, { x: 2_970_000, y: 2_400_000 }, plain, card, reach)
  expect(snapped.box.x + snapped.box.cx).toBe(3_000_000)
  expect(snapped.guides.length).toBeGreaterThan(0)
  const free = drawnShape(
    "box",
    { x: 1_000_000, y: 1_500_000 },
    { x: 2_970_000, y: 2_400_000 },
    { ...plain, free: true },
    card,
    reach,
  )
  expect(free.box.x + free.box.cx).toBe(2_970_000)
  expect(free.guides).toEqual([])
})

it("draws a line up and to the left with the flips that keep its start where the drag began", () => {
  const drawn = drawnShape("line", { x: 3_000_000, y: 3_000_000 }, { x: 1_000_000, y: 2_000_000 }, plain, none, reach)
  expect(drawn.box).toEqual({ x: 1_000_000, y: 2_000_000, cx: 2_000_000, cy: 1_000_000, flipH: true, flipV: true })
})

it("locks a line to 45 degree steps with Shift", () => {
  const drawn = drawnShape(
    "line",
    { x: 1_000_000, y: 1_000_000 },
    { x: 3_000_000, y: 1_100_000 },
    { ...plain, shift: true },
    none,
    reach,
  )
  expect(drawn.box.cy).toBe(0)
  expect(drawn.box.cx).toBeGreaterThan(1_900_000)
})
