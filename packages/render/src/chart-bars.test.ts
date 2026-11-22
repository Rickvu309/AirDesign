import { expect, it } from "vitest"
import type { CanvasChart, CanvasChartFrame, CanvasChartLabel, CanvasChartSeries } from "./chart-record.js"
import { chartLayout, type ChartShape } from "./chart-layout.js"

const look = { size: 10, bold: false, color: "rgb(64, 64, 64)", font: "Inter" }
const frame: CanvasChartFrame = { look, title: null, line: null, gridlines: null, labels: true, shown: true }
const outside = (text: string): CanvasChartLabel => ({ text, look, position: "outsideEnd", dx: 0, dy: 0 })

const series = (name: string, values: readonly number[], labelled: boolean): CanvasChartSeries => ({
  name,
  values,
  texts: values.map(String),
  points: values.map(() => ({ fill: "rgb(47, 91, 211)", line: null })),
  stroke: null,
  marker: false,
  labels: values.map((value) => (labelled ? outside(`$${value.toFixed(1)}`) : null)),
})

const farFromZero = (labelled: boolean): CanvasChart => ({
  kind: "column",
  grouping: "clustered",
  hole: 0,
  firstAngle: 0,
  gap: 1.5,
  overlap: 0,
  categories: ["Jul", "Aug", "Sep"],
  series: [series("Plan", [13.2, 13.6, 14], labelled), series("Actual", [13.9, 14.4, 15], labelled)],
  title: null,
  legend: null,
  fill: null,
  line: null,
  plot: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  valueAxis: {
    ...frame,
    min: 13,
    max: 15,
    ticks: [13, 14, 15].map((value) => ({ value, text: String(value) })),
  },
  categoryAxis: { ...frame, reversed: false },
})

type Rect = Extract<ChartShape, { kind: "rect" }>
type Words = Extract<ChartShape, { kind: "text" }>

const rect = (shapes: readonly ChartShape[], key: string): Rect["box"] => {
  const found = shapes.find((shape): shape is Rect => shape.kind === "rect" && shape.key === key)
  if (found === undefined) throw new Error(key)
  return found.box
}

const word = (shapes: readonly ChartShape[], key: string): Words => {
  const found = shapes.find((shape): shape is Words => shape.kind === "text" && shape.key === key)
  if (found === undefined) throw new Error(key)
  return found
}

it("ends a clustered column at its own value when the axis starts above zero", () => {
  const shapes = chartLayout(farFromZero(false), 400, 300)
  expect(rect(shapes, "bar 0 0").height).toBeCloseTo(240 * 0.1, 6)
  expect(rect(shapes, "bar 0 2").height).toBeCloseTo(240 * 0.5, 6)
  expect(rect(shapes, "bar 1 1").height).toBeCloseTo(240 * 0.7, 6)
  expect(rect(shapes, "bar 1 2").height).toBeCloseTo(240, 6)
  expect(rect(shapes, "bar 0 0").y + rect(shapes, "bar 0 0").height).toBeCloseTo(270, 6)
})

it("ends a clustered bar at its own value when the axis starts above zero", () => {
  const shapes = chartLayout({ ...farFromZero(false), kind: "bar" }, 400, 300)
  expect(rect(shapes, "bar 0 0").x).toBeCloseTo(40, 6)
  expect(rect(shapes, "bar 0 0").width).toBeCloseTo(320 * 0.1, 6)
  expect(rect(shapes, "bar 1 1").width).toBeCloseTo(320 * 0.7, 6)
})

it("keeps a line's points at their values when the axis starts above zero", () => {
  const line = (each: CanvasChartSeries): CanvasChartSeries => ({ ...each, stroke: { color: "black", width: 2 } })
  const chart = farFromZero(false)
  const shapes = chartLayout({ ...chart, kind: "line", series: chart.series.map(line) }, 400, 300)
  const plan = shapes.find((shape) => shape.kind === "polyline" && shape.key === "line 0 0")
  expect(plan?.kind === "polyline" ? plan.points[2]?.[1] : null).toBeCloseTo(270 - 240 * 0.5, 6)
})

const legend = (position: "top" | "bottom"): CanvasChart["legend"] => ({
  position,
  look,
  entries: [
    { text: "Plan", mark: { fill: "rgb(184, 192, 204)", line: null } },
    { text: "Actual", mark: { fill: "rgb(47, 91, 211)", line: null } },
  ],
})

it("keeps the labels above the tallest columns clear of a top legend", () => {
  const shapes = chartLayout({ ...farFromZero(true), plot: null, legend: legend("top") }, 400, 300)
  const key = word(shapes, "legend 0")
  const label = word(shapes, "label 1 2")
  expect(label.align).toBe("bottom")
  expect(label.y - look.size * 1.2).toBeGreaterThanOrEqual(key.y + (look.size * 1.2) / 2)
  expect(rect(shapes, "bar 1 2").y).toBeCloseTo(label.y + 4, 6)
})

it("keeps the labels above the tallest columns inside the chart when no legend sits on top", () => {
  const shapes = chartLayout({ ...farFromZero(true), plot: null, legend: legend("bottom") }, 400, 300)
  const pad = 300 * 0.04 + 2
  expect(word(shapes, "label 1 2").y - look.size * 1.2).toBeGreaterThanOrEqual(pad - 1e-6)
})

it("keeps the labels at the end of the longest bars inside the chart", () => {
  const shapes = chartLayout({ ...farFromZero(true), kind: "bar", plot: null }, 400, 300)
  const label = word(shapes, "label 1 2")
  const pad = 300 * 0.04 + 2
  expect(label.anchor).toBe("start")
  expect(label.x + "$15.0".length * look.size * 0.52).toBeLessThanOrEqual(400 - pad + 1e-6)
})
