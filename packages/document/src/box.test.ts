import fc from "fast-check"
import { expect, it } from "vitest"
import { coordinates, readBox } from "./box.js"

it("reads a box of four whole EMU numbers and nothing else", () => {
  expect(readBox({ x: -5, y: 0, cx: 914400, cy: 457200 })).toEqual({ x: -5, y: 0, cx: 914400, cy: 457200 })
  expect(readBox({ x: -0, y: -0, cx: -0, cy: 0 })).toEqual({ x: 0, y: 0, cx: 0, cy: 0 })
  expect(Object.is(readBox({ x: -0, y: 1, cx: 1, cy: 1 })?.x, 0)).toBe(true)
  for (const raw of [
    null,
    "box",
    [1, 2, 3, 4],
    { x: 1, y: 2, cx: 3 },
    { x: 1, y: 2, cx: 3, cy: 4, rot: 0 },
    { x: 1.5, y: 2, cx: 3, cy: 4 },
    { x: "1", y: 2, cx: 3, cy: 4 },
    { x: 1, y: 2, cx: -1, cy: 4 },
    { x: 1, y: 2, cx: 3, cy: -1 },
    { x: Number.NaN, y: 2, cx: 3, cy: 4 },
    { x: Number.POSITIVE_INFINITY, y: 2, cx: 3, cy: 4 },
    { x: coordinates.lowest - 1, y: 2, cx: 3, cy: 4 },
    { x: 1, y: coordinates.highest + 1, cx: 3, cy: 4 },
    { x: 1, y: 2, cx: coordinates.highest + 1, cy: 4 },
  ]) {
    expect(readBox(raw)).toBeNull()
  }
})

it("reads back every box it accepts unchanged after a JSON trip", () => {
  const coordinate = fc.integer({ min: coordinates.lowest, max: coordinates.highest })
  const extent = fc.integer({ min: 0, max: coordinates.highest })
  fc.assert(
    fc.property(coordinate, coordinate, extent, extent, (x, y, cx, cy) => {
      const box = readBox({ x, y, cx, cy })
      return box !== null && JSON.stringify(readBox(JSON.parse(JSON.stringify(box)))) === JSON.stringify(box)
    }),
  )
})
