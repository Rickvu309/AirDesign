import { barShapes } from "./chart-bars.js"
import type { CanvasChart } from "./chart-record.js"
import { lineHeight, measure, words, wrapped, type ChartBox, type ChartShape } from "./chart-shape.js"

export type { ChartShape } from "./chart-shape.js"

const keyShare = 0.7
const roomShare = 0.04
const roomLeast = 2
const fullTurn = 360
const smallestShare = 0.15
const sideShare = 0.15
const gap = 4
const labelShare = 0.25

const rounded = (value: number): number => Math.round(value * 1000) / 1000

export function sliceAngles(values: readonly (number | null)[], first: number): readonly (readonly [number, number])[] {
  const shown = values.map((value) => Math.max(value ?? 0, 0))
  const total = shown.reduce((sum, value) => sum + value, 0)
  let at = first
  return shown.map((value) => {
    const start = at
    at = rounded(at + (total === 0 ? 0 : (value / total) * fullTurn))
    return [start, at] as const
  })
}

function pointAt(cx: number, cy: number, radius: number, angle: number): string {
  const turn = (angle * Math.PI) / (fullTurn / 2)
  return `${rounded(cx + radius * Math.sin(turn))} ${rounded(cy - radius * Math.cos(turn))}`
}

function slicePath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const whole = end - start >= fullTurn - 1e-6
  const stop = whole ? start + fullTurn / 2 : end
  const large = stop - start > fullTurn / 2 ? 1 : 0
  const arc = (radius: number, from: number, to: number, sweep: 0 | 1) =>
    `A ${rounded(radius)} ${rounded(radius)} 0 ${large} ${sweep} ${pointAt(cx, cy, radius, to)}${whole ? ` A ${rounded(radius)} ${rounded(radius)} 0 ${large} ${sweep} ${pointAt(cx, cy, radius, from)}` : ""}`
  if (inner > 0) {
    const outerArc = `M ${pointAt(cx, cy, outer, start)} ${arc(outer, start, stop, 1)}`
    const innerArc = whole
      ? `M ${pointAt(cx, cy, inner, start)} ${arc(inner, start, stop, 0)}`
      : `L ${pointAt(cx, cy, inner, end)} ${arc(inner, end, start, 0)}`
    return `${outerArc} ${innerArc} Z`
  }
  if (whole) return `M ${pointAt(cx, cy, outer, start)} ${arc(outer, start, stop, 1)} Z`
  return `M ${rounded(cx)} ${rounded(cy)} L ${pointAt(cx, cy, outer, start)} ${arc(outer, start, end, 1)} Z`
}

function roundShapes(chart: CanvasChart, plot: ChartBox, width: number, height: number): readonly ChartShape[] {
  const series = chart.series[0]
  if (series === undefined) return []
  const doughnut = chart.kind === "doughnut"
  const labels = series.labels.map((label) =>
    label === null ? null : { ...label, text: wrapped(label.text, label.look, width * labelShare) },
  )
  const outside = doughnut ? [] : labels.filter((label) => label?.position === "outsideEnd")
  const reach = outside.map((label) => (label === null ? { width: 0, height: 0 } : measure(label.text, label.look)))
  const reachX = Math.max(0, ...reach.map((item) => item.width))
  const reachY = Math.max(0, ...reach.map((item) => item.height))
  const radius = Math.max(
    Math.min(plot.width / 2 - reachX, plot.height / 2 - reachY) - gap,
    (Math.min(plot.width, plot.height) / 2) * smallestShare,
  )
  const inner = doughnut ? radius * chart.hole : 0
  const cx = plot.x + plot.width / 2
  const cy = plot.y + plot.height / 2
  const angles = sliceAngles(series.values, chart.firstAngle)
  const shapes: ChartShape[] = []
  for (const [at, [start, end]] of angles.entries()) {
    const mark = series.points[at]
    if (end <= start || mark === undefined) continue
    shapes.push({ kind: "path", key: `slice 0 ${at}`, d: slicePath(cx, cy, radius, inner, start, end), ...mark })
  }
  for (const [at, [start, end]] of angles.entries()) {
    const label = labels[at]
    if (label === null || label === undefined) continue
    const middle = (((start + end) / 2) * Math.PI) / (fullTurn / 2)
    const sin = Math.sin(middle)
    const cos = Math.cos(middle)
    const distance = doughnut
      ? (radius + inner) / 2
      : label.position === "outsideEnd"
        ? radius + gap
        : label.position === "insideBase"
          ? radius / 4
          : label.position === "center"
            ? radius / 2
            : (radius * 3) / 4
    const out = !doughnut && label.position === "outsideEnd"
    const spot = { x: cx + distance * sin + label.dx * width, y: cy - distance * cos + label.dy * height }
    const anchor = !out || Math.abs(sin) < sideShare ? "middle" : sin > 0 ? "start" : "end"
    const align = !out || Math.abs(cos) < sideShare ? "middle" : cos > 0 ? "bottom" : "top"
    const half = anchor === "middle" ? 0 : measure(label.text, label.look).width / 2
    const centred = { x: spot.x + (anchor === "start" ? half : -half), y: spot.y }
    shapes.push(words(`label 0 ${at}`, label.text, label.look, centred, "middle", align))
  }
  return shapes
}

function legendShapes(
  chart: CanvasChart,
  room: ChartBox,
): { readonly shapes: readonly ChartShape[]; readonly room: ChartBox } {
  const legend = chart.legend
  if (legend === null || legend.entries.length === 0) return { shapes: [], room }
  const { look } = legend
  const key = look.size * keyShare
  const space = look.size * 0.4
  const rowHeight = look.size * lineHeight
  const widths = legend.entries.map((entry) => key + space + measure(entry.text, look).width)
  const shapes: ChartShape[] = []
  const place = (x: number, y: number, at: number) => {
    const entry = legend.entries[at]
    if (entry === undefined) return
    shapes.push({ kind: "rect", key: `key ${at}`, box: { x, y: y - key / 2, width: key, height: key }, ...entry.mark })
    shapes.push(words(`legend ${at}`, entry.text, look, { x: x + key + space, y }, "start", "middle"))
  }
  if (legend.position === "left" || legend.position === "right") {
    const column = Math.max(...widths)
    const total = legend.entries.length * rowHeight
    const x = legend.position === "right" ? room.x + room.width - column : room.x
    const top = room.y + (room.height - total) / 2 + rowHeight / 2
    legend.entries.forEach((_, at) => place(x, top + at * rowHeight, at))
    const width = room.width - column - space * 2
    return { shapes, room: { ...room, x: legend.position === "left" ? room.x + column + space * 2 : room.x, width } }
  }
  const row = widths.reduce((sum, value) => sum + value, 0) + space * 2 * (widths.length - 1)
  const y = legend.position === "bottom" ? room.y + room.height - rowHeight / 2 : room.y + rowHeight / 2
  let x = room.x + (room.width - row) / 2
  legend.entries.forEach((_, at) => {
    place(x, y, at)
    x += (widths[at] ?? 0) + space * 2
  })
  const height = room.height - rowHeight - space
  return { shapes, room: { ...room, y: legend.position === "top" ? room.y + rowHeight + space : room.y, height } }
}

export function chartLayout(chart: CanvasChart, width: number, height: number): readonly ChartShape[] {
  const shapes: ChartShape[] = []
  if (chart.fill !== null || chart.line !== null) {
    const half = (chart.line?.width ?? 0) / 2
    const box = { x: half, y: half, width: width - half * 2, height: height - half * 2 }
    shapes.push({ kind: "rect", key: "area", box, fill: chart.fill, line: chart.line })
  }
  const pad = Math.min(width, height) * roomShare + roomLeast
  let room: ChartBox = { x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }
  if (chart.title !== null) {
    const size = measure(chart.title.text, chart.title.look)
    shapes.push(words("title", chart.title.text, chart.title.look, { x: width / 2, y: room.y }, "middle", "top"))
    const used = size.height + chart.title.look.size * 0.4
    room = { ...room, y: room.y + used, height: room.height - used }
  }
  const legend = legendShapes(chart, room)
  const plot =
    chart.plot === null
      ? legend.room
      : {
          x: chart.plot.x * width,
          y: chart.plot.y * height,
          width: chart.plot.width * width,
          height: chart.plot.height * height,
        }
  const round = chart.kind === "pie" || chart.kind === "doughnut"
  const drawn = round ? roundShapes(chart, plot, width, height) : barShapes(chart, plot, chart.plot !== null)
  return [...shapes, ...drawn, ...legend.shapes]
}
