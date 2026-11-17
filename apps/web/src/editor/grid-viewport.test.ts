import { describe, expect, it } from "vitest"
import { zoomedGrid, fittedGridCards, pannedGrid, boundedGridScale, fittedGrid, revealedGrid } from "./grid-viewport"

describe("grid viewport", () => {
  it("keeps the canvas point under the zoom anchor in place", () => {
    const view = { x: -700, y: 1400, scale: 0.5 }
    const anchor = { x: 430, y: 280 }
    const next = zoomedGrid(view, 2, anchor)
    expect((anchor.x - next.x) / next.scale).toBe((anchor.x - view.x) / view.scale)
    expect((anchor.y - next.y) / next.scale).toBe((anchor.y - view.y) / view.scale)
  })

  it("allows the canvas to remain beyond either edge of the viewport", () => {
    expect(zoomedGrid({ x: -10000, y: 20000, scale: 1 }, 1, { x: 0, y: 0 })).toEqual({
      x: -10000,
      y: 20000,
      scale: 1,
    })
  })
})

it("pans without constraining the canvas", () => {
  expect(pannedGrid({ x: 1, y: 2, scale: 1 }, { x: -900, y: 700 })).toEqual({ x: -899, y: 702, scale: 1 })
})
it("bounds continuous zoom", () => {
  expect(boundedGridScale(0)).toBe(0.1)
  expect(boundedGridScale(100)).toBe(4)
})
it.each([7, 50])("fits and centres every slide of a %i slide deck", (count) => {
  const bounds = { width: 1296, height: Math.ceil(count / 4) * 217 - 24 }
  const room = { width: 1110, height: 700 }
  const view = fittedGrid(bounds, room)
  expect(view.x).toBeGreaterThanOrEqual(48)
  expect(view.y).toBeGreaterThanOrEqual(48)
  expect(view.x * 2 + bounds.width * view.scale).toBeCloseTo(room.width)
  expect(view.y * 2 + bounds.height * view.scale).toBeCloseTo(room.height)
})
it("reveals a selected slide even when zoom makes it larger than the canvas", () => {
  expect(
    revealedGrid(
      { x: 0, y: 0, scale: 8 },
      { left: 3000, top: 2000, width: 2400, height: 1350 },
      { left: 0, top: 0, width: 1000, height: 700 },
    ),
  ).toEqual({ x: -3700, y: -2325, scale: 8 })
})

it("fits occupied cards after the canvas has already been panned and zoomed", () => {
  const view = fittedGridCards({ x: -500, y: 200, scale: 2 }, [{ left: -400, top: 350, width: 640, height: 408 }], {
    left: 100,
    top: 150,
    width: 1470,
    height: 759,
  })
  expect(view.x + 160 * view.scale).toBeCloseTo(735)
  expect(view.y + 102 * view.scale).toBeCloseTo(379.5)
})
