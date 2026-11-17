import { describe, expect, it } from "vitest"
import {
  zoomedGrid,
  fittedGridCards,
  pannedGrid,
  boundedGridScale,
  fittedGrid,
  revealedGrid,
  gridSpacing,
  gridSectionGap,
  wheeledGrid,
  gridScaleMoved,
  arrowGrid,
  readGridViewport,
} from "./grid-viewport"

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
  expect(boundedGridScale(0)).toBe(0.01)
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

describe("grid spacing", () => {
  it("keeps gaps a share of the slide and numbers readable at fifty-slide fit", () => {
    expect(gridSpacing(1280, 720)).toEqual({ column: 166.4, row: 410.4 })
    expect(gridSpacing(960, 720).column).toBeCloseTo(124.8)
  })

  it("reserves a screen-space gutter between section headings and numbers", () => {
    for (const scale of [0.1, 0.4, 1, 4]) expect(gridSectionGap(scale) * scale).toBe(32)
  })
})

describe("grid wheel", () => {
  const plain = { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false }

  it("pans both axes, and Shift turns a vertical mouse wheel sideways", () => {
    expect(wheeledGrid({ x: 40, y: 50, scale: 0.5 }, { ...plain, deltaX: 12, deltaY: 30 }, { x: 0, y: 0 })).toEqual({
      x: 28,
      y: 20,
      scale: 0.5,
    })
    expect(wheeledGrid({ x: 40, y: 50, scale: 0.5 }, { ...plain, deltaY: 80, shiftKey: true }, { x: 0, y: 0 })).toEqual(
      { x: -40, y: 50, scale: 0.5 },
    )
  })

  it("reads a wheel that counts lines as lines of sixteen pixels", () => {
    expect(wheeledGrid({ x: 0, y: 0, scale: 1 }, { ...plain, deltaY: 3, deltaMode: 1 }, { x: 0, y: 0 }).y).toBe(-48)
  })

  it("keeps the pinch anchor across thirty events", () => {
    let view = { x: 40, y: 50, scale: 0.5 }
    const point = (400 - view.x) / view.scale
    for (let i = 0; i < 30; i++) view = wheeledGrid(view, { ...plain, deltaY: -1, ctrlKey: true }, { x: 400, y: 300 })
    expect(view.scale).toBeCloseTo(0.5 * Math.exp(0.3))
    expect((400 - view.x) / view.scale).toBeCloseTo(point)
  })

  it("zooms a mouse wheel notch in a small step instead of a jump", () => {
    const view = { x: 0, y: 0, scale: 1 }
    const notch = wheeledGrid(view, { ...plain, deltaY: -100, ctrlKey: true }, { x: 0, y: 0 })
    const line = wheeledGrid(view, { ...plain, deltaY: -3, deltaMode: 1, metaKey: true }, { x: 0, y: 0 })
    expect(notch.scale).toBeGreaterThan(1.05)
    expect(notch.scale).toBeLessThan(1.15)
    expect(line.scale).toBeCloseTo(notch.scale)
  })

  it("zooms smoothly in both directions below ten percent", () => {
    const view = { x: 0, y: 0, scale: 0.06 }
    expect(wheeledGrid(view, { ...plain, deltaY: -1, ctrlKey: true }, { x: 0, y: 0 }).scale).toBeCloseTo(
      0.06 * Math.exp(0.01),
    )
    expect(wheeledGrid(view, { ...plain, deltaY: 1, ctrlKey: true }, { x: 0, y: 0 }).scale).toBeCloseTo(
      0.06 * Math.exp(-0.01),
    )
  })

  it("treats a percent that went through the zoom readout as the same scale", () => {
    const scale = 0.5 * Math.exp(0.3)
    expect(gridScaleMoved({ x: 0, y: 0, scale }, (scale * 100) / 100)).toBe(false)
    expect(gridScaleMoved({ x: 0, y: 0, scale: 0.07 }, (0.07 * 100) / 100)).toBe(false)
    expect(gridScaleMoved({ x: 0, y: 0, scale }, 0.5)).toBe(true)
  })
})

describe("grid keys and storage", () => {
  it("pans arrow keys in screen pixels independent of zoom", () => {
    expect(arrowGrid({ x: 20, y: 40, scale: 0.2 }, "ArrowRight")).toEqual({ x: -60, y: 40, scale: 0.2 })
    expect(arrowGrid({ x: 20, y: 40, scale: 3 }, "ArrowUp")).toEqual({ x: 20, y: 120, scale: 3 })
  })

  it("reads only finite valid kept places, including fit scales below ten percent", () => {
    expect(readGridViewport('{"x":-120,"y":800,"scale":0.04}')).toEqual({ x: -120, y: 800, scale: 0.04 })
    for (const raw of [null, "oops", "{}", '{"x":0,"y":0,"scale":0}', '{"x":0,"y":0,"scale":1e999}'])
      expect(readGridViewport(raw)).toBeNull()
  })
})

it("can pinch down to the hidden-number overview below ten percent", () => {
  const view = { x: 0, y: 0, scale: 0.05 }
  const next = wheeledGrid(
    view,
    { deltaX: 0, deltaY: 10, deltaMode: 0, shiftKey: false, ctrlKey: true, metaKey: false },
    { x: 0, y: 0 },
  )
  expect(next.scale).toBeLessThan(view.scale)
})

it("shares the Grid range across gestures, fit and stored views", () => {
  const plain = { deltaX: 0, deltaY: 10, deltaMode: 0, shiftKey: false, ctrlKey: true, metaKey: false }
  expect(wheeledGrid({ x: 0, y: 0, scale: 0.01 }, plain, { x: 0, y: 0 }).scale).toBe(0.01)
  expect(fittedGrid({ width: 1e9, height: 1e9 }, { width: 1000, height: 800 }).scale).toBe(0.01)
  for (const scale of [0.01, 0.04, 0.05, 0.07, 4]) {
    expect(boundedGridScale(scale)).toBe(scale)
    expect(readGridViewport(JSON.stringify({ x: 0, y: 0, scale }))).toEqual({ x: 0, y: 0, scale })
  }
  expect(readGridViewport(JSON.stringify({ x: 0, y: 0, scale: 0.001 }))).toBeNull()
})
