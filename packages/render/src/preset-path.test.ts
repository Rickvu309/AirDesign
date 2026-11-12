import { expect, it } from "vitest"
import { presetOutline } from "./preset-path.js"
import { presetGuides } from "./preset-rule.js"

it("reads DrawingML formulas with repeated whitespace without changing their operands", () => {
  const value = presetGuides({ adjusts: [], guides: ["svc */ 50  110557 100000"], paths: [] }, 200, 100, {})
  expect(value("svc")).toBe(55.2785)
})

it("draws a triangle in the whole given box", () => {
  expect(presetOutline("triangle", 200, 100)).toEqual([{ d: "M0 100L100 0L200 100Z", fill: true, stroke: true }])
})

it("uses the triangle's apex adjust and pins it to the box", () => {
  expect(presetOutline("triangle", 200, 100, { adj: 25000 })?.[0]?.d).toBe("M0 100L50 0L200 100Z")
  expect(presetOutline("triangle", 200, 100, { adj: 200000 })?.[0]?.d).toBe("M0 100L200 0L200 100Z")
})

it("sizes an arrowhead from the short side, not the width", () => {
  expect(presetOutline("rightArrow", 200, 100)?.[0]?.d).toBe("M0 25L150 25L150 0L200 50L150 100L150 75L0 75Z")
})

it("draws a pie wedge as the quarter ellipse around its bottom right corner", () => {
  expect(presetOutline("pieWedge", 200, 100)?.[0]?.d).toBe("M0 100A200 100 0 0 1 200 0L200 100Z")
})

it("keeps unknown and custom geometry on the rectangle fallback", () => {
  expect(presetOutline("unknown", 200, 100)).toBeNull()
  expect(presetOutline("custom", 200, 100)).toBeNull()
})

const presets =
  "triangle rtTriangle diamond parallelogram trapezoid pentagon hexagon octagon homePlate chevron rightArrow leftArrow upArrow downArrow leftRightArrow plus star5 round1Rect round2SameRect snip1Rect snip2DiagRect wedgeRectCallout wedgeRoundRectCallout flowChartProcess flowChartDecision flowChartTerminator bracketPair bracePair donut arc can cube rightBrace leftBrace cloud leftRightArrowCallout bentConnector2 bentConnector3 bentConnector4 bentConnector5 curvedConnector2 curvedConnector3 curvedConnector4 curvedConnector5 pieWedge".split(
    " ",
  )

it.each(presets)("draws %s at square, wide, tall, zero and adjusted dimensions", (name) => {
  for (const [width, height] of [
    [100, 100],
    [200, 50],
    [50, 200],
    [0, 100],
    [100, 0],
    [0, 0],
  ]) {
    for (const adjusts of [{}, { adj: 0, adj1: 0, adj2: 0 }, { adj: 100000, adj1: 25000, adj2: 75000 }]) {
      const paths = presetOutline(name, width!, height!, adjusts)
      expect(paths).not.toBeNull()
      expect(paths!.length).toBeGreaterThan(0)
      for (const path of paths!) {
        expect(path.d).toMatch(/^M/)
        expect(path.d).not.toMatch(/NaN|Infinity|undefined/)
      }
    }
  }
})

it("routes a bent connector through its adjusted elbow", () => {
  expect(presetOutline("bentConnector3", 200, 100, { adj1: 25000 })?.[0]).toEqual({
    d: "M0 0L50 0L50 100L200 100",
    fill: false,
    stroke: true,
  })
})

it("routes a curved connector through its cubic control points", () => {
  expect(presetOutline("curvedConnector2", 200, 100)?.[0]).toEqual({
    d: "M0 0C100 0 200 50 200 100",
    fill: false,
    stroke: true,
  })
})

it("keeps the default callout tail outside the box", () => {
  expect(presetOutline("wedgeRectCallout", 120, 80)?.[0]?.d).toContain("L35.0004 90")
})

it("draws an elliptical arc from the radial DrawingML angle", () => {
  expect(presetOutline("arc", 200, 100)?.at(-1)?.d).toBe("M100 0A100 50 0 0 1 200 50")
})
