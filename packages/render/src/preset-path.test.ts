import { expect, it } from "vitest"
import { presetAdjusts, presets as pickable } from "@airdesign/document"
import { adjustDefaults, drawnPresets, openPreset, presetOutline, presetTextArea } from "./preset-path.js"
import { presetGuides } from "./preset-rule.js"

it("reads DrawingML formulas with repeated whitespace without changing their operands", () => {
  const value = presetGuides({ adjusts: [], guides: ["svc */ 50  110557 100000"] }, 200, 100, {})
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

it("calls a line, a connector and an unclosed stroke open, and a closed preset closed", () => {
  expect(pickable.filter((name) => openPreset(name))).toEqual([
    "line",
    "straightConnector1",
    "bracketPair",
    "bracePair",
    "arc",
    "can",
    "cube",
    "rightBrace",
    "leftBrace",
    "cloud",
  ])
  for (const name of [
    "bentConnector2",
    "bentConnector3",
    "bentConnector4",
    "bentConnector5",
    "curvedConnector2",
    "curvedConnector3",
    "curvedConnector4",
    "curvedConnector5",
  ])
    expect(openPreset(name)).toBe(true)
  expect(openPreset("rect")).toBe(false)
  expect(openPreset("ellipse")).toBe(false)
  expect(openPreset("donut")).toBe(false)
  expect(openPreset("unknown")).toBe(false)
})

it("keeps unknown and custom geometry on the rectangle fallback", () => {
  expect(presetOutline("unknown", 200, 100)).toBeNull()
  expect(presetOutline("custom", 200, 100)).toBeNull()
})

const presets =
  "triangle rtTriangle diamond parallelogram trapezoid pentagon hexagon octagon homePlate chevron rightArrow leftArrow upArrow downArrow leftRightArrow plus star5 round1Rect round2SameRect snip1Rect snip2DiagRect wedgeRectCallout wedgeRoundRectCallout flowChartProcess flowChartDecision flowChartTerminator bracketPair bracePair donut arc can cube rightBrace leftBrace cloud leftRightArrowCallout bentConnector2 bentConnector3 bentConnector4 bentConnector5 curvedConnector2 curvedConnector3 curvedConnector4 curvedConnector5 pieWedge roundRect frame corner star4 upDownArrow notchedRightArrow flowChartInputOutput flowChartManualOperation flowChartMerge flowChartExtract flowChartPreparation flowChartManualInput flowChartOffpageConnector flowChartPunchedCard".split(
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

it("rounds a rounded rectangle's corners by its adjust, as PowerPoint does", () => {
  expect(presetOutline("roundRect", 200, 100, { adj: 50000 })?.[0]?.d).toBe(
    "M0 50A50 50 0 0 1 50 0L150 0A50 50 0 0 1 200 50L200 50A50 50 0 0 1 150 100L50 100A50 50 0 0 1 0 50Z",
  )
})

it("cuts a frame's hole by its border adjust", () => {
  expect(presetOutline("frame", 200, 100, { adj1: 10000 })?.[0]?.d).toBe(
    "M0 0L200 0L200 100L0 100ZM10 10L10 90L190 90L190 10Z",
  )
})

it("narrows an up-down arrow's shaft and heads by its adjusts", () => {
  expect(presetOutline("upDownArrow", 100, 200)?.[0]?.d).toBe(
    "M0 50L50 0L100 50L75 50L75 150L100 150L50 200L0 150L25 150L25 50Z",
  )
})

it("scales a flowchart path drawn on its own grid to the box", () => {
  expect(presetOutline("flowChartInputOutput", 200, 100)?.[0]?.d).toBe("M0 100L40 0L200 0L160 100Z")
})

it("draws every preset a person or an agent can pick, with the same adjusts, and offers every one but the routed lines", () => {
  const native = ["rect", "ellipse", "line", "straightConnector1"]
  for (const preset of pickable) {
    const names: readonly string[] = presetAdjusts[preset]
    if (native.includes(preset)) expect(adjustDefaults(preset), preset).toEqual({})
    else expect(presetOutline(preset, 200, 100), preset).not.toBeNull()
    expect(Object.keys(adjustDefaults(preset)), preset).toEqual(names)
  }
  expect(drawnPresets.filter((name) => !(pickable as readonly string[]).includes(name))).toEqual(
    ["bentConnector", "curvedConnector"].flatMap((routed) => [2, 3, 4, 5].map((bends) => `${routed}${String(bends)}`)),
  )
})

it("lays text in PowerPoint's text area for each preset, as margins from the box", () => {
  expect(presetTextArea("rect", 200, 100)).toBeNull()
  expect(presetTextArea("wedgeRectCallout", 200, 100)).toBeNull()
  expect(presetTextArea("unknown", 200, 100)).toBeNull()
  expect(presetTextArea("rightArrow", 400, 200)).toEqual({ left: 0, top: 50, right: 50, bottom: 50 })
  expect(presetTextArea("chevron", 400, 200)).toEqual({ left: 100, top: 0, right: 100, bottom: 0 })
  expect(presetTextArea("diamond", 200, 100)).toEqual({ left: 50, top: 25, right: 50, bottom: 25 })
  const ellipse = presetTextArea("ellipse", 200, 100)
  expect(ellipse?.left).toBeCloseTo(100 - 100 * Math.SQRT1_2, 6)
  expect(ellipse?.top).toBeCloseTo(50 - 50 * Math.SQRT1_2, 6)
  expect(presetTextArea("roundRect", 200, 100, { adj: 50000 })?.left).toBeCloseTo(50 * 0.29289, 6)
})

it("keeps every preset's text area inside its box, at any size and adjust", () => {
  for (const preset of [...pickable, ...drawnPresets])
    for (const [width, height] of [
      [200, 100],
      [50, 200],
      [0, 0],
    ] as const)
      for (const adjusts of [{}, { adj: 0, adj1: 0, adj2: 0 }, { adj: 100000, adj1: 100000, adj2: 100000 }]) {
        const area = presetTextArea(preset, width, height, adjusts)
        if (area === null) continue
        for (const margin of Object.values(area)) expect(margin, preset).toBeGreaterThanOrEqual(0)
        expect(area.left + area.right, preset).toBeLessThanOrEqual(width + 1e-9)
        expect(area.top + area.bottom, preset).toBeLessThanOrEqual(height + 1e-9)
      }
})

it("shades a cube's side and top and a can's top as PowerPoint's path fills say", () => {
  expect(presetOutline("cube", 100, 100)?.map((path) => path.shade)).toEqual([
    undefined,
    "darkenLess",
    "lightenLess",
    undefined,
  ])
  expect(presetOutline("can", 100, 100)?.map((path) => path.shade)).toEqual([undefined, "lighten", undefined])
})
