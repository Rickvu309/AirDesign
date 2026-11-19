import { describe, expect, it } from "vitest"
import { percentWidth } from "./canvas-zoom"
import { gridLineGap } from "@/editor/grid-lines"
import {
  fittedGridGroups,
  gridThumbHeight,
  fittedGridElements,
  resizedGrid,
  zoomedGrid,
  fittedGridCards,
  pannedGrid,
  boundedGridScale,
  fittedGrid,
  gridLayoutLines,
  gridTrackGap,
  gridTrackSize,
  revealedGrid,
  gridSpacing,
  gridCardBounds,
  wheeledGrid,
  gridScaleMoved,
  arrowGrid,
  readGridViewport,
  type GridGeometry,
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

it("fits the occupied cards across section headers with screen-space padding", () => {
  const view = fittedGridCards(
    {
      groups: [
        { start: 0, end: 2 },
        { start: 2, end: 4 },
      ],
      width: 1000,
      height: 500,
    },
    [1, 3],
    { width: 1096, height: 1473 },
  )
  const scale = (1000 - 4) / (1000 + 65)
  expect(view?.scale).toBeCloseTo(scale)
  expect(view?.y).toBeCloseTo((1473 - 1333 * scale) / 2)
  expect(view?.x).toBeCloseTo(48 - 1130 * scale)
})

describe("grid spacing", () => {
  it("keeps gaps a share of the slide and numbers readable at fifty-slide fit", () => {
    expect(gridSpacing(1280, 720)).toEqual({ column: 166.4, line: 410.4 })
    expect(gridSpacing(960, 720).column).toBeCloseTo(124.8)
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

describe("scale-independent group fit", () => {
  for (const count of [1, 7, 41, 50]) {
    for (const width of [1470, 1280, 1110, 920]) {
      for (const height of [759, 556]) {
        it(`fits ${count} slides in ${width}x${height}`, () => {
          const groups = Array.from({ length: Math.ceil(count / 4) }, (_, i) => ({
            start: i * 4,
            end: Math.min(count, i * 4 + 4),
          }))
          const geometry = { groups, width: 960, height: 720 }
          const room = { width, height }
          const fit = fittedGridGroups(geometry, room)
          const lines = gridLayoutLines(geometry)
          const shown = lines.reduce((total, line, index) => {
            const size = gridTrackSize(line, geometry, gridTrackGap(geometry, lines, index))
            return total + size.world * fit.scale + size.fixed
          }, 0)
          expect(fit.y).toBeGreaterThanOrEqual(48 - 1e-8)
          expect(fit.y + shown).toBeLessThanOrEqual(height - 48 + 1e-8)
          expect(fit.x).toBeGreaterThanOrEqual(48 - 1e-8)
          expect(Array.from({ length: 6 }, () => fittedGridGroups(geometry, room))).toEqual(Array(6).fill(fit))
        })
      }
    }
  }
})

it("pans only newly clipped previously visible slides by the minimum distance", () => {
  const view = { x: 0, y: 0, scale: 0.5 }
  const old = { left: 0, top: 96, width: 1470, height: 759 }
  const next = { ...old, width: 1110 }
  expect(resizedGrid(view, { left: 806, top: 132, width: 640, height: 360 }, old, next)).toEqual({ ...view, x: -336 })
  expect(resizedGrid(view, { left: -1, top: 132, width: 640, height: 360 }, old, next)).toEqual(view)
  expect(resizedGrid(view, { left: 100, top: 132, width: 640, height: 360 }, old, next)).toEqual(view)
  expect(resizedGrid(view, { left: 806, top: 132, width: 640, height: 360 }, next, old)).toEqual(view)
})

it("zooms a fully visible target out until its width fits the narrower room", () => {
  const view = { x: 20, y: 30, scale: 1 }
  const before = { left: 100, top: 50, width: 1400, height: 800 }
  const after = { left: 100, top: 50, width: 900, height: 800 }
  const box = { left: 150, top: 80, width: 1000, height: 400 }
  const next = resizedGrid(view, box, before, after)
  const centre = box.top + box.height / 2
  expect(next.scale).toBeCloseTo(0.804)
  expect(next.scale).toBeLessThan(view.scale)
  expect(next.x).toBeCloseTo(48 - 30 * next.scale)
  expect(after.top + next.y + ((centre - after.top - view.y) / view.scale) * next.scale).toBeCloseTo(centre)
  expect(after.left + next.x + ((box.left - after.left - view.x) / view.scale) * next.scale).toBeCloseTo(
    after.left + 48,
  )
})

it("keeps the vertical centre when a screen-fixed heading sits above the target", () => {
  const view = { x: 20, y: 30, scale: 1.68 }
  const before = { left: 0, top: 0, width: 1470, height: 800 }
  const after = { left: 0, top: 0, width: 1110, height: 800 }
  const box = { left: 48, top: 200, width: 1374, height: 219 }
  const fixed = 44
  const next = resizedGrid(view, box, before, after, fixed)
  const centre = box.top + box.height / 2
  const world = (centre - after.top - view.y - fixed) / view.scale
  expect(next.scale).toBeLessThan(view.scale)
  expect(after.top + next.y + fixed + world * next.scale).toBeCloseTo(centre)
  expect(after.top + next.y + ((centre - after.top - view.y) / view.scale) * next.scale).not.toBeCloseTo(centre)
})

it("fits a horizontally visible target that already overflows the room vertically", () => {
  const view = { x: 0, y: 0, scale: 1 }
  const before = { left: 0, top: 0, width: 1000, height: 500 }
  const after = { left: 0, top: 0, width: 800, height: 500 }
  expect(resizedGrid(view, { left: 700, top: -10, width: 200, height: 100 }, before, after)).toEqual({
    x: -100,
    y: 0,
    scale: 1,
  })
  const wide = resizedGrid(view, { left: 50, top: -10, width: 900, height: 100 }, before, after)
  expect(wide.scale).toBeCloseTo(704 / 900)
  expect(wide.scale).toBeLessThan(view.scale)
})

it("leaves a vertically panned target where it is when the room does not move", () => {
  const view = { x: 70, y: -473, scale: 1 }
  const room = { left: 0, top: 96, width: 1400, height: 759 }
  const box = { left: 120, top: -300, width: 960, height: 540 }
  expect(resizedGrid(view, box, room, room)).toBe(view)
})

it("does not zoom in when the room grows or cannot hold the fit padding", () => {
  const view = { x: 0, y: 0, scale: 0.5 }
  const narrow = { left: 0, top: 0, width: 80, height: 200 }
  const wide = { left: 0, top: 0, width: 400, height: 200 }
  const box = { left: 10, top: 20, width: 100, height: 40 }
  expect(resizedGrid(view, box, narrow, wide)).toEqual(view)
  expect(resizedGrid(view, box, wide, narrow)).toEqual({ ...view, x: -10 })
})

it("fits the rotated union in a sectioned group using the world geometry", () => {
  const geometry = {
    groups: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    width: 1000,
    height: 500,
  }
  const boxes = [
    { x: 100, y: 50, width: 400, height: 100, rotation: 90 },
    { x: 600, y: 50, width: 100, height: 100, rotation: 0 },
  ]
  const view = fittedGridElements(geometry, 3, boxes, 1000, { width: 996, height: 696 })
  expect(view?.scale).toBe(1.5)
  expect(view?.x).toBeCloseTo((996 - 450 * 1.5) / 2 - (1130 + 250) * 1.5)
  expect(view?.y).toBeCloseTo(48 - (500 + 24 + 285 + 24 - 100) * 1.5)
})

it("clamps a very small element to Grid's maximum zoom", () => {
  const geometry = { groups: [{ start: 0, end: 1 }], width: 1000, height: 500 }
  const box = { x: 100, y: 50, width: 1, height: 1, rotation: 0 }
  expect(fittedGridElements(geometry, 0, [box], 1000, { width: 996, height: 696 })?.scale).toBe(4)
})

it("fits and centres the widest group including its handle and end dot", () => {
  const room = { width: 1280, height: 720 }
  const fit = fittedGridGroups({ groups: [{ start: 0, end: 4 }], width: 1280, height: 720 }, room)
  const left = fit.x - 46
  const right = fit.x + (4 * 1280 + 3.5 * 166.4) * fit.scale + 4
  expect(left).toBeGreaterThanOrEqual(48 - 1e-8)
  expect(right).toBeLessThanOrEqual(room.width - 48 + 1e-8)
  expect(left + right).toBeCloseTo(room.width)
})

it("reveals group chrome with breathing room and stays put when it already fits", () => {
  const view = { x: 0, y: 0, scale: 0.25 }
  const geometry = { groups: [{ start: 0, end: 4 }], width: 1280, height: 720 }
  const room = { left: 0, top: 0, width: 1280, height: 720 }
  const first = { left: 24, top: 24, width: 320, height: 180 }
  const bounds = gridCardBounds(geometry, 0, view.scale, first)
  expect(bounds.left).toBe(-22)
  expect(revealedGrid(view, bounds, room).x).toBe(46)
  expect(revealedGrid(view, { ...bounds, left: 24 }, room)).toEqual(view)
  expect(gridCardBounds(geometry, 0, 0.05, first)).toEqual(first)
  const last = gridCardBounds(geometry, 3, view.scale, { ...first, left: 920 })
  expect(last.width).toBeCloseTo(344.8)
})

it("fits a selected group head and tail using the stored columns and their chrome", () => {
  const geometry = { groups: [{ start: 0, end: 4 }], width: 1280, height: 720 }
  const room = { width: 1280, height: 720 }
  const view = fittedGridCards(geometry, [0, 3], room)
  const fitted = fittedGridGroups(geometry, room)
  expect(view?.scale).toBeCloseTo(fitted.scale, 9)
  expect(view?.x).toBeCloseTo(fitted.x, 9)
  expect(view?.y).toBeCloseTo(fitted.y, 9)
})

it("places later lines of one group closer together than the next group", () => {
  const groups = [
    { start: 0, end: 1 },
    { start: 1, end: 29 },
    { start: 29, end: 39 },
    { start: 39, end: 41 },
  ]
  const geometry = { groups, width: 960, height: 540 }
  const lines = gridLayoutLines(geometry)
  expect(lines.map((line) => line.end - line.start)).toEqual([1, 10, 10, 8, 10, 2])
  const gaps = lines.map((_, index) => gridTrackGap(geometry, lines, index))
  expect(gaps[1]).toBeLessThan(gaps[3] ?? 0)
  expect(gaps[1]).toBe(gridLineGap(gridSpacing(960, 540).line, gridSpacing(960, 540).column))
  const tops: number[] = []
  let top = 0
  for (const [index, line] of lines.entries()) {
    tops.push(top)
    top += gridTrackSize(line, geometry, gaps[index] ?? 0).world
  }
  expect(tops[2]! - tops[1]!).toBeLessThan(tops[4]! - tops[3]!)
  const plain = {
    groups: [
      { start: 0, end: 4 },
      { start: 4, end: 8 },
    ],
    width: 960,
    height: 540,
  }
  const fitting = gridLayoutLines(plain)
  expect(fitting).toHaveLength(2)
  expect(gridTrackGap(plain, fitting, 0)).toBe(gridSpacing(960, 540).line)
})

const wide = { width: 12_192_000, height: 6_858_000 }
const fourByThree = { width: 9_144_000, height: 6_858_000 }
const thumbWidth = 197
const fitRoom = { width: 1470, height: 759 }

function slideBox(slide: { width: number; height: number }) {
  const width = percentWidth(100, slide)
  const thumb = Math.round((thumbWidth * slide.height) / slide.width)
  return { width, height: gridThumbHeight(width, thumb, thumbWidth) }
}

function deck(slide: { width: number; height: number }, sizes: readonly number[]): GridGeometry {
  const box = slideBox(slide)
  let start = 0
  const groups = sizes.map((size) => {
    const group = { start, end: start + size }
    start += size
    return group
  })
  return {
    groups,
    groupHandles: true,
    width: box.width,
    height: box.height,
  }
}

function screenGaps(geometry: GridGeometry, scale: number) {
  const lines = gridLayoutLines(geometry)
  let within: number | null = null
  let between: number | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const next = lines[index + 1]
    const line = lines[index]
    if (next === undefined || line === undefined) continue
    const gap = gridTrackGap(geometry, lines, index)
    if (within === null && next.number === line.number) within = gap
    if (between === null && next.number !== line.number) between = gap
  }
  return {
    within: within === null ? null : within * scale,
    between: between === null ? null : between * scale,
  }
}

describe("Fit without a heading band", () => {
  it("fits the four reference decks in the 1470 by 923 grid room", () => {
    const twelve = deck(wide, Array(12).fill(2))
    const heat = deck(fourByThree, [1, 28, 10, 2])
    const six = deck(wide, [3, 3])
    const plain = deck(wide, [6])
    const heatScale = fittedGridGroups(heat, fitRoom).scale
    const fit = screenGaps(heat, heatScale)
    const quarter = screenGaps(heat, 0.25)
    expect(Math.round(fittedGridGroups(twelve, fitRoom).scale * 100)).toBe(5)
    expect(Math.round(heatScale * 100)).toBe(11)
    expect(Math.round(fittedGridGroups(six, fitRoom).scale * 100)).toBe(31)
    expect(Math.round(fittedGridGroups(plain, fitRoom).scale * 100)).toBe(23)
    expect(fit.within).toBeCloseTo(13.9, 0)
    expect(fit.between).toBeCloseTo(45.77, 1)
    expect(quarter.within).toBeCloseTo(31.2, 1)
    expect(quarter.between).toBeCloseTo(102.74, 1)
  })

  it("keeps wrapped lines of the heat-pump deck closer than the next group at Fit and at 25%", () => {
    const heat = deck(fourByThree, [1, 28, 10, 2])
    const fit = fittedGridGroups(heat, fitRoom).scale
    for (const scale of [fit, 0.25]) {
      const gaps = screenGaps(heat, scale)
      expect(gaps.within).not.toBeNull()
      expect(gaps.between).not.toBeNull()
      expect(gaps.between ?? 0).toBeGreaterThan((gaps.within ?? 0) * 2)
    }
  })
})
