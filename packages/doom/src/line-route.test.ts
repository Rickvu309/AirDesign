import { describe, expect, it } from "vitest"
import { curvePoints, elbowPoints } from "./line-route.js"

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })

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

  it("never enters through its target: it comes round to the attached side", () => {
    const points = elbowPoints(
      { at: { x: 0, y: 100 }, side: "r", around: null },
      { at: { x: 200, y: 0 }, side: "t", around: box(150, 0, 100, 100) },
    )
    expect(points).toEqual([
      { x: 0, y: 100 },
      { x: 24, y: 100 },
      { x: 24, y: -24 },
      { x: 200, y: -24 },
      { x: 200, y: 0 },
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
