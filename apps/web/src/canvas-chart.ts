import type { PaintColor, PaintElement } from "@airdesign/pptx"
import type { CanvasChart } from "@airdesign/render"
import { cssColor } from "@/paint-css"

type PaintChart = NonNullable<PaintElement["chart"]>
type PaintLook = NonNullable<PaintChart["title"]>["look"]
type PaintMark = PaintChart["series"][number]["points"][number]
type PaintLine = NonNullable<PaintMark["line"]>
type PaintFrame = Omit<NonNullable<PaintChart["categoryAxis"]>, "reversed">

function color(value: PaintColor | null): string | null {
  return value === null ? null : cssColor(value)
}

function line(value: PaintLine | null) {
  return value === null ? null : { color: cssColor(value.color), width: value.width }
}

function look(value: PaintLook) {
  return { ...value, color: color(value.color) }
}

function mark(value: PaintMark) {
  return { fill: color(value.fill), line: line(value.line) }
}

function words<T extends { readonly look: PaintLook }>(value: T | null) {
  return value === null ? null : { ...value, look: look(value.look) }
}

function frame<T extends PaintFrame>(value: T) {
  return {
    ...value,
    look: look(value.look),
    title: words(value.title),
    line: line(value.line),
    gridlines: line(value.gridlines),
  }
}

export function canvasChart(chart: PaintChart): CanvasChart {
  return {
    ...chart,
    series: chart.series.map((series) => ({
      ...series,
      points: series.points.map(mark),
      stroke: line(series.stroke),
      labels: series.labels.map(words),
    })),
    title: words(chart.title),
    legend:
      chart.legend === null
        ? null
        : {
            ...chart.legend,
            look: look(chart.legend.look),
            entries: chart.legend.entries.map((entry) => ({ text: entry.text, mark: mark(entry.mark) })),
          },
    fill: color(chart.fill),
    line: line(chart.line),
    valueAxis: chart.valueAxis === null ? null : frame(chart.valueAxis),
    categoryAxis: chart.categoryAxis === null ? null : frame(chart.categoryAxis),
  }
}
