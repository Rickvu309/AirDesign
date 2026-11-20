import { expect, it } from "vitest"
import type {
  CanvasChart,
  CanvasChartAxis,
  CanvasChartCategoryAxis,
  CanvasChartFrame,
  CanvasChartSeries,
} from "./chart-record.js"
import { chartLayout, sliceAngles, type ChartShape } from "./chart-layout.js"

const look = { size: 10, bold: false, color: "rgb(64, 64, 64)", font: "Calibri" }
const frame: CanvasChartFrame = { look, title: null, line: null, gridlines: null, labels: true, shown: true }
const axis = (min: number, max: number, unit: number): CanvasChartAxis => ({
  ...frame,
  min,
  max,
  ticks: Array.from({ length: Math.round((max - min) / unit) + 1 }, (_, at) => ({
    value: min + at * unit,
    text: String(min + at * unit),
  })),
})

const series = (name: string, values: readonly (number | null)[], fill: string): CanvasChartSeries => ({
  name,
  values,
  texts: values.map((value) => (value === null ? "" : String(value))),
  points: values.map(() => ({ fill, line: null })),
  stroke: null,
  marker: false,
  labels: values.map(() => null),
})

const base: CanvasChart = {
  kind: "column",
  grouping: "clustered",
  hole: 0,
  firstAngle: 0,
  gap: 1.5,
  overlap: 0,
  categories: ["2023", "2024"],
  series: [series("North", [3, 5], "rgb(44, 86, 122)"), series("South", [4, 7], "rgb(0, 114, 199)")],
  title: null,
  legend: null,
  fill: null,
  line: null,
  plot: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  valueAxis: axis(0, 12, 2),
  categoryAxis: { ...frame, reversed: false },
}

type Rect = Extract<ChartShape, { kind: "rect" }>

const rect = (shapes: readonly ChartShape[], key: string): Rect["box"] => {
  const found = shapes.find((shape): shape is Rect => shape.kind === "rect" && shape.key === key)
  if (found === undefined) throw new Error(key)
  return found.box
}

const texts = (shapes: readonly ChartShape[]) =>
  shapes.flatMap((shape) => (shape.kind === "text" ? [shape.lines.join("\n")] : []))

it("turns pie values into clockwise angles from twelve o'clock", () => {
  expect(sliceAngles([1, 1, 2], 0)).toEqual([
    [0, 90],
    [90, 180],
    [180, 360],
  ])
  expect(sliceAngles([96, 4], 90)).toEqual([
    [90, 435.6],
    [435.6, 450],
  ])
  expect(sliceAngles([1, null, -2, 1], 0)).toEqual([
    [0, 180],
    [180, 180],
    [180, 180],
    [180, 360],
  ])
})

it("draws each slice from the centre and ends the first quarter at three o'clock", () => {
  const chart: CanvasChart = {
    ...base,
    kind: "pie",
    plot: { x: 0, y: 0, width: 1, height: 1 },
    series: [series("Share", [1, 1, 2], "rgb(44, 86, 122)")],
    valueAxis: null,
    categoryAxis: null,
  }
  const slice = chartLayout(chart, 200, 200).find((shape) => shape.kind === "path" && shape.key === "slice 0 0")
  if (slice?.kind !== "path") throw new Error("slice")
  const numbers = slice.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const [cx = 0, cy = 0, startX = 0, startY = 0] = numbers
  const [endX = 0, endY = 0] = numbers.slice(-2)
  const radius = cy - startY
  expect([cx, cy, startX]).toEqual([100, 100, 100])
  expect(radius).toBeGreaterThan(60)
  expect(endX).toBeCloseTo(100 + radius, 6)
  expect(endY).toBeCloseTo(100, 6)
})

it("cuts a hole in a doughnut", () => {
  const chart: CanvasChart = {
    ...base,
    kind: "doughnut",
    hole: 0.5,
    plot: { x: 0, y: 0, width: 1, height: 1 },
    series: [series("Share", [1, 3], "rgb(44, 86, 122)")],
    valueAxis: null,
    categoryAxis: null,
  }
  const slice = chartLayout(chart, 200, 200).find((shape) => shape.kind === "path" && shape.key === "slice 0 1")
  if (slice?.kind !== "path") throw new Error("slice")
  expect(slice.d.match(/A/g)).toHaveLength(2)
  expect(slice.d.startsWith("M 100 100")).toBe(false)
})

it("stacks columns so each height matches its value and the tallest total reaches the axis top", () => {
  const shapes = chartLayout({ ...base, grouping: "stacked", overlap: 1 }, 400, 300)
  const north = rect(shapes, "bar 0 0")
  const south = rect(shapes, "bar 1 0")
  expect(south.height / north.height).toBeCloseTo(4 / 3, 6)
  expect(south.y + south.height).toBeCloseTo(north.y, 6)
  expect(south.x).toBeCloseTo(north.x, 6)
  expect(rect(shapes, "bar 1 1").y).toBeCloseTo(30, 6)
  expect(north.y + north.height).toBeCloseTo(270, 6)
})

it("fills each category to the top in a percent stack", () => {
  const shapes = chartLayout({ ...base, grouping: "percentStacked", overlap: 1, valueAxis: axis(0, 1, 0.5) }, 400, 300)
  const total = rect(shapes, "bar 0 1").height + rect(shapes, "bar 1 1").height
  expect(total).toBeCloseTo(240, 6)
})

it("places clustered columns side by side with heights in proportion", () => {
  const shapes = chartLayout(base, 400, 300)
  const north = rect(shapes, "bar 0 1")
  const south = rect(shapes, "bar 1 1")
  expect(north.x + north.width).toBeCloseTo(south.x, 6)
  expect(south.height / north.height).toBeCloseTo(7 / 5, 6)
  expect(north.width).toBeCloseTo(160 / 3.5, 6)
})

it("lays bars along the value axis from the left, first category at the bottom", () => {
  const shapes = chartLayout({ ...base, kind: "bar" }, 400, 300)
  const first = rect(shapes, "bar 0 0")
  const last = rect(shapes, "bar 0 1")
  expect(first.x).toBeCloseTo(40, 6)
  expect(last.width / first.width).toBeCloseTo(5 / 3, 6)
  expect(first.y).toBeGreaterThan(last.y)
})

it("lists categories from the top when the category axis runs in reverse, as a ranked bar chart reads", () => {
  const categoryAxis: CanvasChartCategoryAxis = { ...frame, reversed: true }
  const shapes = chartLayout({ ...base, kind: "bar", categoryAxis }, 400, 300)
  const first = rect(shapes, "bar 0 0")
  const last = rect(shapes, "bar 0 1")
  expect(first.y).toBeLessThan(last.y)
  const word = (text: string) =>
    shapes.find((shape) => shape.kind === "text" && shape.lines.join("") === text && shape.key.startsWith("category"))
  const top = word("2023")
  const bottom = word("2024")
  if (top?.kind !== "text" || bottom?.kind !== "text") throw new Error("categories")
  expect(top.y).toBeLessThan(bottom.y)
  expect(rect(shapes, "bar 0 0").y).toBeLessThan(rect(shapes, "bar 1 0").y)
  const columns = chartLayout({ ...base, categoryAxis }, 400, 300)
  expect(rect(columns, "bar 0 0").x).toBeGreaterThan(rect(columns, "bar 0 1").x)
  expect(rect(columns, "bar 0 0").x).toBeGreaterThan(rect(columns, "bar 1 0").x)
})

it("breaks a line where a value is missing", () => {
  const line: CanvasChartSeries = {
    ...series("Visits", [1, null, 3, 4], "rgb(0, 114, 199)"),
    stroke: { color: "rgb(0, 114, 199)", width: 2.25 },
    marker: true,
  }
  const shapes = chartLayout({ ...base, kind: "line", categories: ["a", "b", "c", "d"], series: [line] }, 400, 300)
  const strokes = shapes.filter((shape) => shape.kind === "polyline" && shape.key.startsWith("line 0"))
  expect(strokes.map((shape) => (shape.kind === "polyline" ? shape.points.length : 0))).toEqual([1, 2])
  expect(shapes.filter((shape) => shape.kind === "circle")).toHaveLength(3)
})

it("wraps a long label at about a fifth of the chart's width so the pie keeps its size", () => {
  const long = { text: "Owner with mortgage; 25%", look, position: "outsideEnd" as const, dx: 0, dy: 0 }
  const chart: CanvasChart = {
    ...base,
    kind: "pie",
    plot: null,
    series: [{ ...series("Share", [1, 3], "rgb(44, 86, 122)"), labels: [long, null] }],
    valueAxis: null,
    categoryAxis: null,
  }
  const label = chartLayout(chart, 300, 300).find((shape) => shape.kind === "text" && shape.key === "label 0 0")
  expect(label?.kind === "text" ? label.lines : []).toEqual(["Owner with", "mortgage; 25%"])
  expect(label?.kind === "text" ? label.anchor : null).toBe("middle")
  expect(label?.kind === "text" ? label.x : 0).toBeGreaterThan(150 + 13 * 10 * 0.26)
})

it("writes the title, the axis steps, the categories, the labels and the legend", () => {
  const labelled: CanvasChartSeries = {
    ...base.series[0]!,
    labels: [null, { text: "5", look, position: "outsideEnd", dx: 0, dy: 0 }],
  }
  const shapes = chartLayout(
    {
      ...base,
      plot: null,
      title: { text: "Sales", look: { ...look, size: 14 } },
      series: [labelled, base.series[1]!],
      legend: {
        position: "bottom",
        look,
        entries: [
          { text: "North", mark: { fill: "rgb(44, 86, 122)", line: null } },
          { text: "South", mark: { fill: "rgb(0, 114, 199)", line: null } },
        ],
      },
    },
    400,
    300,
  )
  expect(texts(shapes)).toEqual(expect.arrayContaining(["Sales", "0", "12", "2023", "2024", "5", "North", "South"]))
})
