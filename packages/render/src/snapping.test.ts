import { describe, expect, it } from "vitest"
import { nearestLine, reachOf, snapMove, snapReach, type Bounds, type SnapTargets } from "./snapping.js"

const slide: Bounds = { left: 0, top: 0, right: 2000, bottom: 1000 }

function at(left: number, top: number, width = 100, height = 100): Bounds {
  return { left, top, right: left + width, bottom: top + height }
}

function targets(...layers: readonly Bounds[]): SnapTargets {
  return { layers, slide }
}

describe("snapMove", () => {
  it("snaps a left edge onto another layer's right edge and draws one guide through both", () => {
    const snapped = snapMove(at(503, 300), targets(at(400, 100)), 5)
    expect(snapped.box).toEqual(at(500, 300))
    expect(snapped.guides).toEqual([
      { kind: "snap", axis: "x", at: 500, from: 100, to: 400, marks: [100, 200, 300, 400] },
    ])
  })

  it("snaps a centre onto another layer's centre on both axes", () => {
    const snapped = snapMove(at(302, 598, 60, 60), targets(at(280, 580, 100, 100)), 5)
    expect(snapped.box).toEqual(at(300, 600, 60, 60))
    expect(snapped.guides).toEqual([
      { kind: "snap", axis: "x", at: 330, from: 580, to: 680, marks: [630] },
      { kind: "snap", axis: "y", at: 630, from: 280, to: 380, marks: [330] },
    ])
  })

  it("snaps to the slide's edges and its centre", () => {
    expect(snapMove(at(4, 300), targets(), 5).box).toEqual(at(0, 300))
    expect(snapMove(at(300, 897), targets(), 5).box).toEqual(at(300, 900))
    const centred = snapMove(at(947, 447), targets(), 5)
    expect(centred.box).toEqual(at(950, 450))
    expect(centred.guides).toEqual([
      { kind: "snap", axis: "x", at: 1000, from: 0, to: 1000, marks: [500] },
      { kind: "snap", axis: "y", at: 500, from: 0, to: 2000, marks: [1000] },
    ])
  })

  it("takes the nearer of two lines and draws every alignment at the place it lands", () => {
    const snapped = snapMove(at(503, 300), targets(at(400, 100), at(507, 500), at(500, 600, 60, 100)), 5)
    expect(snapped.box).toEqual(at(500, 300))
    expect(snapped.guides).toEqual([
      { kind: "snap", axis: "x", at: 500, from: 100, to: 700, marks: [100, 200, 300, 400, 600, 700] },
    ])
  })

  it("leaves a layer beyond the reach where it is, with no guides", () => {
    const snapped = snapMove(at(506, 306), targets(at(400, 100)), 5)
    expect(snapped.box).toEqual(at(506, 306))
    expect(snapped.guides).toEqual([])
  })

  it("snaps halfway between two neighbours in its row and marks both equal gaps", () => {
    const snapped = snapMove(at(248, 120), targets(at(100, 100), at(400, 130)), 5)
    expect(snapped.box).toEqual(at(250, 120))
    expect(snapped.guides).toContainEqual({ kind: "spacing", axis: "x", from: 200, to: 250, across: 160 })
    expect(snapped.guides).toContainEqual({ kind: "spacing", axis: "x", from: 350, to: 400, across: 175 })
  })

  it("repeats the gap of a neighbouring pair on either side", () => {
    const after = snapMove(at(343, 110), targets(at(100, 100), at(220, 100)), 5)
    expect(after.box).toEqual(at(340, 110))
    expect(after.guides).toEqual([
      { kind: "spacing", axis: "x", from: 200, to: 220, across: 150 },
      { kind: "spacing", axis: "x", from: 320, to: 340, across: 155 },
    ])
    const before = snapMove(at(110, 363), targets(at(100, 500), at(100, 640)), 5)
    expect(before.box).toEqual(at(110, 360))
    expect(before.guides).toEqual([
      { kind: "spacing", axis: "y", from: 460, to: 500, across: 155 },
      { kind: "spacing", axis: "y", from: 600, to: 640, across: 150 },
    ])
  })

  it("counts only layers that overlap it on the other axis as its row", () => {
    const snapped = snapMove(at(248, 380), targets(at(100, 100), at(400, 100)), 5)
    expect(snapped.box).toEqual(at(248, 380))
    expect(snapped.guides).toEqual([])
  })
})

describe("reachOf", () => {
  it("holds the reach at the same number of screen pixels at every zoom", () => {
    const wide = 12_192_000
    expect(reachOf(800, wide)).toBeCloseTo((snapReach * wide) / 800)
    const layer = targets(at(0, 0, 3_000_000, 1_000_000))
    const near = at(3_000_000 + 60_000, 2_000_000, 1_000_000, 1_000_000)
    expect(snapMove(near, layer, reachOf(800, wide)).box.left).toBe(3_000_000)
    expect(snapMove(near, layer, reachOf(1600, wide)).box.left).toBe(3_060_000)
  })

  it("snaps at 4.4 screen pixels and not at 4.6", () => {
    const perPixel = 15_240
    const layer = targets(at(0, 0, 3_000_000, 1_000_000))
    const within = at(3_000_000 + 4.4 * perPixel, 2_000_000, 1_000_000, 1_000_000)
    const beyond = at(3_000_000 + 4.6 * perPixel, 2_000_000, 1_000_000, 1_000_000)
    expect(snapMove(within, layer, reachOf(800, 12_192_000)).box.left).toBe(3_000_000)
    expect(snapMove(beyond, layer, reachOf(800, 12_192_000)).box.left).toBe(beyond.left)
  })
})

describe("nearestLine", () => {
  it("names the watched line nearest a target and how far it has to go", () => {
    const box = at(100, 100, 296, 203)
    expect(nearestLine(box, targets(at(400, 300)), "x", ["end"], 5)).toEqual({ line: "end", offset: 4 })
    expect(nearestLine(box, targets(at(400, 300)), "y", ["start", "end"], 5)).toEqual({ line: "end", offset: -3 })
  })

  it("watches only the lines it is given", () => {
    expect(nearestLine(at(503, 100), targets(at(400, 0)), "x", ["end"], 5)).toBeNull()
    expect(nearestLine(at(503, 100), targets(at(400, 0)), "x", ["start"], 5)).toEqual({ line: "start", offset: -3 })
  })
})

describe("guides", () => {
  const guided = (x: readonly number[], y: readonly number[]): SnapTargets => ({ layers: [], slide, guides: { x, y } })

  it("snaps a layer's edges and centre onto a guide on its own axis, drawing no snap guide over it", () => {
    expect(snapMove(at(612, 300), guided([610], []), 5)).toEqual({ box: at(610, 300), guides: [] })
    expect(snapMove(at(612, 300), guided([], [610]), 5).box).toEqual(at(612, 300))
    expect(snapMove(at(300, 657), guided([], [710]), 5).box).toEqual(at(300, 660))
    expect(snapMove(at(300, 657), guided([], [758]), 5).box).toEqual(at(300, 658))
  })

  it("lets a resize find a guide as it finds a layer's edge", () => {
    expect(nearestLine(at(300, 300), guided([403], []), "x", ["end"], 5)).toEqual({ line: "end", offset: 3 })
  })
})
