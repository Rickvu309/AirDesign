import { describe, expect, it } from "vitest"
import { arrow, circleRadius, crossesBox, place, relative, tipGap } from "./placement.mjs"

const area = { width: 400, height: 300 }
const inside = (box, point) =>
  point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height
const distance = (box, point) =>
  Math.hypot(
    Math.max(box.x - point.x, 0, point.x - box.x - box.width),
    Math.max(box.y - point.y, 0, point.y - box.y - box.height),
  )

describe("placement", () => {
  it("puts the circle on the side with free space and never on its target", () => {
    const box = { x: 20, y: 140, width: 60, height: 20 }
    const [spot] = place([box], area)
    expect(spot.x).toBeGreaterThan(box.x + box.width)
    expect(distance(box, spot)).toBeGreaterThan(circleRadius)
  })

  it("keeps circles off every target and off each other", () => {
    const boxes = [
      { x: 100, y: 100, width: 80, height: 20 },
      { x: 100, y: 126, width: 80, height: 20 },
      { x: 100, y: 152, width: 80, height: 20 },
    ]
    const spots = place(boxes, area)
    for (const spot of spots) for (const box of boxes) expect(distance(box, spot)).toBeGreaterThan(circleRadius)
    for (const [index, spot] of spots.entries())
      for (const other of spots.slice(index + 1))
        expect(Math.hypot(spot.x - other.x, spot.y - other.y)).toBeGreaterThan(circleRadius * 2)
  })

  it("uses the frame's margin when the target fills the crop", () => {
    const [spot] = place([{ x: 0, y: 0, width: 400, height: 300 }], area)
    expect(spot.x < 0 || spot.y < 0 || spot.x > 400 || spot.y > 300).toBe(true)
  })

  it("leaves a missing target without a circle", () => {
    expect(place([null], area)).toEqual([null])
  })

  it("ends the arrow just outside its target, pointing at it", () => {
    const box = { x: 100, y: 100, width: 50, height: 20 }
    const line = arrow({ x: 200, y: 110 }, box)
    expect(inside(box, line.to)).toBe(false)
    expect(distance(box, line.to)).toBeCloseTo(tipGap, 5)
    expect(line.from.x).toBeCloseTo(200 - circleRadius - 2, 5)
  })

  it("clips a box to the crop and drops one wholly outside it", () => {
    const crop = { x: 100, y: 50, width: 200, height: 100 }
    expect(relative({ x: 90, y: 60, width: 30, height: 10 }, crop)).toEqual({ x: 0, y: 10, width: 20, height: 10 })
    expect(relative({ x: 400, y: 60, width: 30, height: 10 }, crop)).toBeNull()
  })

  it("keeps the circle and its arrow off text near the target", () => {
    const box = { x: 100, y: 140, width: 80, height: 20 }
    const texts = [
      { x: 20, y: 100, width: 300, height: 14 },
      { x: 20, y: 120, width: 300, height: 14 },
      { x: 20, y: 166, width: 300, height: 14 },
      { x: 20, y: 186, width: 300, height: 14 },
    ]
    const [spot] = place([box], area, { obstacles: texts })
    for (const text of texts) expect(distance(text, spot)).toBeGreaterThan(circleRadius)
    const line = arrow(spot, box)
    for (const text of texts) expect(crossesBox(line.from, line.to, text)).toBe(false)
  })

  it("ignores text inside the target itself", () => {
    const box = { x: 100, y: 140, width: 80, height: 20 }
    const inner = { x: 104, y: 143, width: 70, height: 14 }
    expect(place([box], area, { obstacles: [inner] })).toEqual(place([box], area))
  })

  it("finds where a segment runs through a box", () => {
    const box = { x: 10, y: 10, width: 20, height: 20 }
    expect(crossesBox({ x: 0, y: 20 }, { x: 40, y: 20 }, box)).toBe(true)
    expect(crossesBox({ x: 0, y: 0 }, { x: 40, y: 0 }, box)).toBe(false)
  })
})
