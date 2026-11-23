import { describe, expect, it } from "vitest"
import { routePath } from "./node-outline.js"

const points = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 200, y: 100 },
]

describe("routePath", () => {
  it("draws a straight line or an elbow through its route's points", () => {
    expect(routePath({ route: "straight", points: [points[0]!, points[3]!] })).toBe("M0 0L200 100")
    expect(routePath({ route: "elbow", points })).toBe("M0 0L100 0L100 100L200 100")
  })

  it("draws a curve as one cubic through its two pulls", () => {
    expect(routePath({ route: "curve", points })).toBe("M0 0C100 0 100 100 200 100")
  })
})
