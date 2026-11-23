import { describe, expect, it } from "vitest"
import { endOnShape } from "./line-ends.js"
import { curvePoints, elbowPoints } from "./line-route.js"

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
const placed = (x: number, y: number, w: number, h: number, rotation = 0) => ({
  x,
  y,
  w,
  h,
  rotation,
  flipH: false,
  flipV: false,
})

describe("an elbow line's route", () => {
  it("splits halfway between two ends that face each other", () => {
    expect(
      elbowPoints({ at: { x: 0, y: 0 }, side: "r", around: null }, { at: { x: 200, y: 100 }, side: "l", around: null }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ])
  })

  it("splits a gap narrower than two stubs halfway, rather than going round", () => {
    expect(
      elbowPoints(
        { at: { x: 100, y: 50 }, side: "r", around: box(0, 0, 100, 100) },
        { at: { x: 130, y: 110 }, side: "l", around: box(130, 60, 100, 100) },
      ),
    ).toEqual([
      { x: 100, y: 50 },
      { x: 115, y: 50 },
      { x: 115, y: 110 },
      { x: 130, y: 110 },
    ])
  })

  it("leaves by its side's stub and goes around when the target is behind it", () => {
    expect(
      elbowPoints(
        { at: { x: 300, y: 50 }, side: "r", around: box(200, 0, 100, 100) },
        { at: { x: 0, y: 50 }, side: "l", around: box(0, 0, 100, 100) },
      ),
    ).toEqual([
      { x: 300, y: 50 },
      { x: 324, y: 50 },
      { x: 324, y: -24 },
      { x: -24, y: -24 },
      { x: -24, y: 50 },
      { x: 0, y: 50 },
    ])
  })

  it("turns once when the corner lies outside the target, on the side it attaches to", () => {
    expect(
      elbowPoints({ at: { x: 0, y: 0 }, side: "r", around: null }, { at: { x: 200, y: 100 }, side: "t", around: null }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
    ])
  })

  it("never enters through its target: it comes round to the attached side, its upright leg midway in the gap", () => {
    const points = elbowPoints(
      { at: { x: 0, y: 100 }, side: "r", around: null },
      { at: { x: 200, y: 0 }, side: "t", around: box(150, 0, 100, 100) },
    )
    expect(points).toEqual([
      { x: 0, y: 100 },
      { x: 75, y: 100 },
      { x: 75, y: -24 },
      { x: 200, y: -24 },
      { x: 200, y: 0 },
    ])
  })

  it("keeps both sides and stubs, and crosses the overlap, when a site sits inside the other shape", () => {
    expect(
      elbowPoints(
        { at: { x: 100, y: 50 }, side: "r", around: box(0, 0, 100, 100) },
        { at: { x: 50, y: 80 }, side: "l", around: box(50, 30, 100, 100) },
      ),
    ).toEqual([
      { x: 100, y: 50 },
      { x: 124, y: 50 },
      { x: 124, y: 65 },
      { x: 26, y: 65 },
      { x: 26, y: 80 },
      { x: 50, y: 80 },
    ])
  })

  it("draws one plain line along the shared edge of two shapes that touch, as PowerPoint does", () => {
    expect(
      elbowPoints(
        { at: { x: 100, y: 30 }, side: "r", around: box(0, 0, 100, 60) },
        { at: { x: 100, y: 70 }, side: "l", around: box(100, 40, 100, 60) },
      ),
    ).toEqual([
      { x: 100, y: 30 },
      { x: 100, y: 70 },
    ])
  })

  it("takes the stubbed route, not a line through empty space, when facing sides sit level but share no edge", () => {
    expect(
      elbowPoints(
        { at: { x: 50, y: 0 }, side: "t", around: box(0, 0, 100, 60) },
        { at: { x: -150, y: 0 }, side: "b", around: box(-200, -60, 100, 60) },
      ),
    ).toEqual([
      { x: 50, y: 0 },
      { x: 50, y: -24 },
      { x: -50, y: -24 },
      { x: -50, y: 24 },
      { x: -150, y: 24 },
      { x: -150, y: 0 },
    ])
  })

  it("keeps both ends of a line between touching shapes whose sites meet", () => {
    expect(
      elbowPoints(
        { at: { x: 100, y: 30 }, side: "r", around: box(0, 0, 100, 60) },
        { at: { x: 100, y: 30 }, side: "l", around: box(100, 0, 100, 60) },
      ),
    ).toEqual([
      { x: 100, y: 30 },
      { x: 100, y: 30 },
    ])
  })

  it("leaves a shape turned 45 degrees from its site and goes round the other shape, not through it", () => {
    const turned = endOnShape({ kind: "rect" }, placed(0, 0, 100, 60, 45), 0, 0, "t")
    const level = endOnShape({ kind: "rect" }, placed(100, 0, 100, 60), 100, 0, "t")
    expect(elbowPoints(turned, level)).toEqual([
      { x: 71.213203, y: 8.786797 },
      { x: 95.213203, y: 8.786797 },
      { x: 95.213203, y: -12 },
      { x: 150, y: -12 },
      { x: 150, y: 0 },
    ])
  })

  it("leaves a triangle's side site between its slope and a shape inside its box, without touching either", () => {
    const triangle = endOnShape({ kind: "preset", name: "triangle" }, placed(0, 0, 100, 100), 0, 0, "r")
    const square = endOnShape({ kind: "rect" }, placed(80, 20, 100, 100), 80, 20, "t")
    expect(elbowPoints(triangle, square)).toEqual([
      { x: 75, y: 50 },
      { x: 77.5, y: 50 },
      { x: 77.5, y: 8 },
      { x: 130, y: 8 },
      { x: 130, y: 20 },
    ])
  })

  it("routes from a free end with one turn into the attached side", () => {
    expect(
      elbowPoints(
        { at: { x: 0, y: 0 }, side: null, around: null },
        { at: { x: 200, y: 100 }, side: "t", around: null },
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
    ])
  })

  it("splits two free ends along the longer way, as before", () => {
    expect(
      elbowPoints(
        { at: { x: 300, y: 100 }, side: null, around: null },
        { at: { x: 100, y: 400 }, side: null, around: null },
      ),
    ).toEqual([
      { x: 300, y: 100 },
      { x: 300, y: 250 },
      { x: 100, y: 250 },
      { x: 100, y: 400 },
    ])
  })
})

describe("a curved line's route", () => {
  it("bends out of each attached side before it turns to the other end", () => {
    expect(
      curvePoints({ at: { x: 0, y: 0 }, side: "b", around: null }, { at: { x: 200, y: 100 }, side: "l", around: null }),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ])
  })
})
