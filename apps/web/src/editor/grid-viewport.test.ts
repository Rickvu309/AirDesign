import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { gridLayout, gridSpacing } from "@/editor/grid-lines"
import {
  arrowGrid,
  boundedGridScale,
  fittedGrid,
  fittedGridCards,
  fittedGridElements,
  gridGrip,
  gridShown,
  keptGridShows,
  pannedGrid,
  readGridViewport,
  resizedGrid,
  revealedGrid,
  wheeledGrid,
  zoomedGrid,
} from "./grid-viewport"

const wide = { width: 1920, height: 1080 }
const fourByThree = { width: 1440, height: 1080 }

function deckOf(lengths: readonly number[], slide = wide) {
  let next = 0
  return gridLayout(
    lengths.map((length) => Array.from({ length }, () => doom.nodeId(`s:${String(next++)}`))),
    slide,
  )
}

describe("grid viewport", () => {
  it("fits selected elements by their box inside the card, with no room taken for a header", () => {
    const card = { left: 100, top: 200, width: 1920, height: 1080 }
    const bounds = { left: 200, top: 100, width: 400, height: 200 }
    const room = { width: 1000, height: 800 }
    const fit = fittedGrid({ width: bounds.width, height: bounds.height }, room)
    expect(fittedGridElements(card, bounds, room)).toEqual({
      x: fit.x - (card.left + bounds.left) * fit.scale,
      y: fit.y - (card.top + bounds.top) * fit.scale,
      scale: fit.scale,
    })
    expect(fittedGridElements(card, { ...bounds, width: 0 }, room)).toBeNull()
  })

  it("keeps the canvas point under the zoom anchor in place", () => {
    const view = { x: -700, y: 1400, scale: 0.5 }
    const anchor = { x: 430, y: 280 }
    const next = zoomedGrid(view, 2, anchor)
    expect((anchor.x - next.x) / next.scale).toBe((anchor.x - view.x) / view.scale)
    expect((anchor.y - next.y) / next.scale).toBe((anchor.y - view.y) / view.scale)
  })

  it("allows the canvas to remain beyond either edge of the viewport", () => {
    expect(zoomedGrid({ x: -10000, y: 20000, scale: 1 }, 1, { x: 0, y: 0 })).toEqual({ x: -10000, y: 20000, scale: 1 })
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

  it("reveals a slide by the least pan that leaves a 24 pixel margin, and stays put when it shows", () => {
    const view = { x: 0, y: 0, scale: 1 }
    const room = { left: 0, top: 0, width: 1000, height: 700 }
    expect(revealedGrid(view, { left: 900, top: 100, width: 200, height: 100 }, room)).toEqual({
      x: -124,
      y: 0,
      scale: 1,
    })
    expect(revealedGrid(view, { left: 100, top: 100, width: 200, height: 100 }, room)).toBe(view)
  })
})

describe("zoom to selected slides", () => {
  it("fits the selected slides and their number room with screen-space padding", () => {
    const layout = deckOf([2, 2], { width: 1000, height: 500 })
    const spacing = gridSpacing({ width: 1000, height: 500 })
    const room = { width: 1096, height: 1473 }
    const view = fittedGridCards(layout, [1, 3], room)
    const tall = 2 * (500 + spacing.inset) + spacing.group
    expect(view?.scale).toBe(1)
    expect(view?.x).toBeCloseTo(48 - (1000 + spacing.column))
    expect(view?.y).toBeCloseTo((1473 - tall) / 2)
    expect(fittedGridCards(layout, [], room)).toBeNull()
  })

  it("fills the canvas with one slide", () => {
    const layout = deckOf([4])
    const view = fittedGridCards(layout, [2], { width: 1200, height: 900 })
    expect(view?.scale).toBeCloseTo((1200 - 96) / 1920)
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

  it("zooms smoothly in both directions below ten percent, down to the hidden-number overview", () => {
    const view = { x: 0, y: 0, scale: 0.06 }
    expect(wheeledGrid(view, { ...plain, deltaY: -1, ctrlKey: true }, { x: 0, y: 0 }).scale).toBeCloseTo(
      0.06 * Math.exp(0.01),
    )
    expect(wheeledGrid(view, { ...plain, deltaY: 1, ctrlKey: true }, { x: 0, y: 0 }).scale).toBeCloseTo(
      0.06 * Math.exp(-0.01),
    )
  })
})

describe("grid keys and storage", () => {
  it("pans arrow keys in screen pixels independent of zoom", () => {
    expect(arrowGrid({ x: 20, y: 40, scale: 0.2 }, "ArrowRight")).toEqual({ x: -60, y: 40, scale: 0.2 })
    expect(arrowGrid({ x: 20, y: 40, scale: 3 }, "ArrowUp")).toEqual({ x: 20, y: 120, scale: 3 })
    const view = { x: 0, y: 0, scale: 1 }
    expect(arrowGrid(view, "Enter")).toBe(view)
  })

  it("reads only finite valid kept places, including fit scales below ten percent", () => {
    expect(readGridViewport('{"x":-120,"y":800,"scale":0.04}')).toEqual({ x: -120, y: 800, scale: 0.04 })
    for (const raw of [null, "oops", "{}", '{"x":0,"y":0,"scale":0}', '{"x":0,"y":0,"scale":1e999}', "[1]"])
      expect(readGridViewport(raw)).toBeNull()
  })

  it("shares the Grid range across gestures, fit and stored views", () => {
    const pinch = { deltaX: 0, deltaY: 10, deltaMode: 0, shiftKey: false, ctrlKey: true, metaKey: false }
    expect(wheeledGrid({ x: 0, y: 0, scale: 0.01 }, pinch, { x: 0, y: 0 }).scale).toBe(0.01)
    expect(fittedGrid({ width: 1e9, height: 1e9 }, { width: 1000, height: 800 }).scale).toBe(0.01)
    for (const scale of [0.01, 0.04, 0.05, 0.07, 4]) {
      expect(boundedGridScale(scale)).toBe(scale)
      expect(readGridViewport(JSON.stringify({ x: 0, y: 0, scale }))).toEqual({ x: 0, y: 0, scale })
    }
    expect(readGridViewport(JSON.stringify({ x: 0, y: 0, scale: 0.001 }))).toBeNull()
  })
})

describe("fit the deck", () => {
  for (const count of [1, 7, 41, 50]) {
    for (const width of [1470, 1280, 1110, 920]) {
      for (const height of [759, 556]) {
        it(`fits ${String(count)} slides in ${String(width)}x${String(height)}`, () => {
          const layout = deckOf(Array.from({ length: Math.ceil(count / 4) }, (_, at) => Math.min(4, count - at * 4)))
          const fit = fittedGrid(layout, { width, height })
          expect(fit.y).toBeGreaterThanOrEqual(48 - 1e-8)
          expect(fit.y + layout.height * fit.scale).toBeLessThanOrEqual(height - 48 + 1e-8)
          expect(fit.x).toBeGreaterThanOrEqual(48 - 1e-8)
          expect(fit.x + layout.width * fit.scale).toBeLessThanOrEqual(width - 48 + 1e-8)
        })
      }
    }
  }

  it("shows the reference decks at the old Grid's sizes, keeping room for the slide group grips", () => {
    const room = { width: 1470, height: 759 }
    const shown = (lengths: readonly number[], slide = wide) => {
      const layout = deckOf(lengths, slide)
      return Math.round(fittedGrid(layout, room, slide.height).scale * slide.width)
    }
    expect([shown(Array(12).fill(2)), shown([1, 28, 10, 2], fourByThree), shown([3, 3]), shown([6])]).toEqual([
      63, 107, 407, 303,
    ])
  })

  it("keeps the grips' room left of the slides only at sizes that show the grips", () => {
    const room = { width: 1470, height: 759 }
    const roomy = deckOf([3, 3])
    const fit = fittedGrid(roomy, room, wide.height)
    expect(wide.height * fit.scale).toBeGreaterThanOrEqual(gridGrip.minimumHeight)
    expect(fit.x - (gridGrip.offset + gridGrip.width / 2)).toBeCloseTo(room.width - fit.x - roomy.width * fit.scale)
    const small = deckOf(Array(12).fill(2))
    expect(fittedGrid(small, room, wide.height)).toEqual(fittedGrid(small, room))
    const edge = deckOf([6])
    const tight = { width: 96 + ((gridGrip.minimumHeight + 0.1) / wide.height) * edge.width, height: 2000 }
    const kept = fittedGrid(edge, tight, wide.height)
    expect(wide.height * fittedGrid(edge, tight).scale).toBeGreaterThanOrEqual(gridGrip.minimumHeight)
    expect(wide.height * kept.scale).toBeLessThan(gridGrip.minimumHeight)
    expect(wide.height * kept.scale).toBeGreaterThan(gridGrip.minimumHeight - 0.1)
  })
})

describe("resize", () => {
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
    expect(next.x).toBeCloseTo(48 - 30 * next.scale)
    expect(after.top + next.y + ((centre - after.top - view.y) / view.scale) * next.scale).toBeCloseTo(centre)
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
    const narrow = resizedGrid(view, { left: 50, top: -10, width: 900, height: 100 }, before, after)
    expect(narrow.scale).toBeCloseTo(704 / 900)
  })

  it("leaves a vertically panned target where it is when the room does not move", () => {
    const view = { x: 70, y: -473, scale: 1 }
    const room = { left: 0, top: 96, width: 1400, height: 759 }
    expect(resizedGrid(view, { left: 120, top: -300, width: 960, height: 540 }, room, room)).toBe(view)
  })

  it("does not zoom in when the room grows or cannot hold the fit padding", () => {
    const view = { x: 0, y: 0, scale: 0.5 }
    const narrow = { left: 0, top: 0, width: 80, height: 200 }
    const roomy = { left: 0, top: 0, width: 400, height: 200 }
    const box = { left: 10, top: 20, width: 100, height: 40 }
    expect(resizedGrid(view, box, narrow, roomy)).toEqual(view)
    expect(resizedGrid(view, box, roomy, narrow)).toEqual({ ...view, x: -10 })
  })
})

describe("painting only what shows", () => {
  it("paints the slides on screen and a margin around it, and none beyond", () => {
    const layout = deckOf([10])
    const room = { width: 1000, height: 600 }
    const step = (1920 + gridSpacing(wide).column) * 0.1
    expect(gridShown(layout, { x: 0, y: 0, scale: 0.1 }, room, 0)).toEqual(
      layout.cards.filter((card) => card.left * 0.1 < 1000 && card.top * 0.1 < 600).map((card) => card.index),
    )
    expect(gridShown(layout, { x: -2 * step, y: 0, scale: 0.1 }, room, 0)[0]).toBe(2)
    expect(gridShown(layout, { x: 5000, y: 0, scale: 0.1 }, room, 200)).toEqual([])
    expect(gridShown(layout, { x: 1100, y: 0, scale: 0.1 }, room, 200)).toEqual([0, 4, 8])
  })
})

describe("a kept camera after the deck changed", () => {
  const room = { width: 1000, height: 600 }

  it("stays where it was while it shows any slide, and stays fit or unmeasured as it is", () => {
    const layout = deckOf([4, 3])
    const showing = { x: -100, y: -50, scale: 0.2 }
    expect(keptGridShows(showing, layout, room, 6)).toBe(showing)
    expect(keptGridShows("fit", layout, room, 6)).toBe("fit")
    const empty = { x: 50_000, y: 0, scale: 0.2 }
    expect(keptGridShows(empty, layout, { width: 0, height: 0 }, 0)).toBe(empty)
  })

  it("moves to the focused slide at the same zoom when no slide is left on screen, or fits with nothing to focus", () => {
    const before = deckOf([4, 3])
    const seventh = before.cards[6]!
    const zoomed = { x: 500 - seventh.left - seventh.width / 2, y: 300 - seventh.top - seventh.height / 2, scale: 1 }
    const after = deckOf([4, 2])
    expect(gridShown(after, zoomed, room, 0)).toEqual([])
    const kept = keptGridShows(zoomed, after, room, 5)
    expect(kept).not.toBe("fit")
    if (kept === "fit") return
    expect(kept.scale).toBe(1)
    expect(gridShown(after, kept, room, 0)).toContain(5)
    expect(keptGridShows(zoomed, after, room, undefined)).toBe("fit")
  })
})
