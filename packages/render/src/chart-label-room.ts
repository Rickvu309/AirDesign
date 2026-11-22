import type { CanvasChart } from "./chart-record.js"
import { measure } from "./chart-shape.js"

export function labelRoom(chart: CanvasChart, length: number, gap: number): number {
  const axis = chart.valueAxis
  if (axis === null || chart.grouping !== "clustered") return 0
  const horizontal = chart.kind === "bar"
  const past = chart.kind === "line" ? "above" : "outsideEnd"
  const span = axis.max - axis.min || 1
  let room = 0
  for (const series of chart.series) {
    series.labels.forEach((label, at) => {
      const value = series.values[at]
      if (label === null || label.position !== past || value === null || value === undefined || value < 0) return
      const share = (Math.min(Math.max(value, axis.min), axis.max) - axis.min) / span
      if (share <= 0) return
      const size = measure(label.text, label.look)
      const need = gap + (horizontal ? size.width : size.height)
      room = Math.max(room, (need - length * (1 - share)) / share)
    })
  }
  return room
}
