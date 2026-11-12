import type { PaintElement } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { paintFrame } from "./canvas-frame"
import { cssColor } from "./paint-css"

type PaintChart = NonNullable<PaintElement["chart"]>

const look = { size: 11.97, bold: false, color: { hex: "404040", alpha: 1 }, font: "Calibri" }
const navy = { hex: "2C567A", alpha: 1 }
const glass = { hex: "FFFFFF", alpha: 0.5 }

const chart: PaintChart = {
  kind: "column",
  grouping: "stacked",
  hole: 0,
  firstAngle: 0,
  gap: 1.5,
  overlap: 1,
  categories: ["2023"],
  series: [
    {
      name: "North",
      values: [3],
      texts: ["3"],
      points: [{ fill: navy, line: { color: glass, width: 1.5 } }],
      stroke: null,
      marker: false,
      labels: [{ text: "3", look, position: "center", dx: 0, dy: 0 }],
    },
  ],
  title: { text: "Sales", look: { ...look, color: null } },
  legend: { position: "right", look, entries: [{ text: "North", mark: { fill: navy, line: null } }] },
  fill: glass,
  line: null,
  plot: null,
  valueAxis: {
    look,
    title: null,
    line: null,
    gridlines: { color: navy, width: 0.75 },
    labels: true,
    shown: true,
    min: 0,
    max: 3,
    ticks: [{ value: 0, text: "0" }],
  },
  categoryAxis: { look, title: { text: "Year", look }, line: null, gridlines: null, labels: true, shown: true },
}

const row = {
  part: "ppt/slides/slide1.xml",
  shape: "5",
  from: "slide",
  kind: "p:graphicFrame",
  image: null,
  box: { x: 0, y: 0, width: 4_398_818, height: 3_976_687, rotation: 0, flipH: false, flipV: false },
  group: null,
  placeholder: null,
  text: null,
  fill: null,
  line: null,
  geometry: null,
  chart,
} as unknown as PaintElement

it("carries a chart onto the canvas with every colour written for the page", () => {
  const painted = paintFrame({ row, shape: undefined, key: "ppt/slides/slide1.xml#5", src: () => null })
  const canvas = painted.chart
  expect(painted.unshownText).toBeUndefined()
  expect(canvas?.fill).toBe(cssColor(glass))
  expect(canvas?.series[0]?.points[0]).toEqual({ fill: cssColor(navy), line: { color: cssColor(glass), width: 1.5 } })
  expect(canvas?.series[0]?.labels[0]?.look.color).toBe(cssColor(look.color))
  expect(canvas?.title?.look.color).toBeNull()
  expect(canvas?.legend?.entries[0]?.mark.fill).toBe(cssColor(navy))
  expect(canvas?.valueAxis?.gridlines?.color).toBe(cssColor(navy))
  expect(canvas?.categoryAxis?.title?.text).toBe("Year")
  expect(canvas?.series[0]?.texts).toEqual(["3"])
})
