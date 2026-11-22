import type { CanvasChart, CanvasChartLabel, CanvasChartLine } from "./chart-record.js"
import { labelRoom } from "./chart-label-room.js"
import { measure, words, type ChartBox, type ChartShape } from "./chart-shape.js"

const gap = 4
const markerRadius = 2.5
const quarterTurn = -90

type Placed = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

function shrunk(chart: CanvasChart, room: ChartBox, manual: boolean): { plot: ChartBox; shapes: ChartShape[] } {
  const shapes: ChartShape[] = []
  const valueAxis = chart.valueAxis
  const categoryAxis = chart.categoryAxis
  if (valueAxis === null || categoryAxis === null || manual) return { plot: room, shapes }
  const horizontal = chart.kind === "bar"
  const valueTexts = valueAxis.shown && valueAxis.labels ? valueAxis.ticks.map((tick) => tick.text) : []
  const categoryTexts = categoryAxis.shown && categoryAxis.labels ? chart.categories : []
  const valueSizes = valueTexts.map((text) => measure(text, valueAxis.look))
  const categorySizes = categoryTexts.map((text) => measure(text, categoryAxis.look))
  const wide = (sizes: readonly { width: number }[]) =>
    sizes.length === 0 ? 0 : Math.max(...sizes.map((size) => size.width)) + gap
  const tall = (sizes: readonly { height: number }[]) =>
    sizes.length === 0 ? 0 : Math.max(...sizes.map((size) => size.height)) + gap
  const side = horizontal ? categoryAxis : valueAxis
  const under = horizontal ? valueAxis : categoryAxis
  let { x, y, width, height } = room
  const sideTitle = side.shown ? side.title : null
  const underTitle = under.shown ? under.title : null
  if (sideTitle !== null) {
    const size = measure(sideTitle.text, sideTitle.look)
    shapes.push(
      words(
        "side title",
        sideTitle.text,
        sideTitle.look,
        { x: x + size.height / 2, y: y + height / 2 },
        "middle",
        "middle",
        quarterTurn,
      ),
    )
    x += size.height + gap
    width -= size.height + gap
  }
  if (underTitle !== null) {
    const size = measure(underTitle.text, underTitle.look)
    height -= size.height + gap
    shapes.push(
      words(
        "under title",
        underTitle.text,
        underTitle.look,
        { x: x + width / 2, y: y + height + gap + size.height },
        "middle",
        "bottom",
      ),
    )
  }
  const left = horizontal ? wide(categorySizes) : wide(valueSizes)
  const bottom = horizontal ? tall(valueSizes) : tall(categorySizes)
  const top = horizontal
    ? 0
    : Math.max(0, labelRoom(chart, height - bottom, gap), ...valueSizes.map((size) => size.height / 2))
  const right = horizontal ? labelRoom(chart, width - left, gap) : 0
  return {
    plot: { x: x + left, y: y + top, width: width - left - right, height: height - bottom - top },
    shapes,
  }
}

function labelSpot(label: CanvasChartLabel, bar: Placed, horizontal: boolean, negative: boolean) {
  const centre = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 }
  const position = label.position
  if (horizontal) {
    const end = negative ? bar.x : bar.x + bar.width
    const start = negative ? bar.x + bar.width : bar.x
    const out = negative ? "end" : "start"
    const inside = negative ? "start" : "end"
    if (position === "center") return { at: centre, anchor: "middle", align: "middle" } as const
    if (position === "insideEnd")
      return { at: { x: end + (negative ? gap : -gap), y: centre.y }, anchor: inside, align: "middle" } as const
    if (position === "insideBase")
      return { at: { x: start + (negative ? -gap : gap), y: centre.y }, anchor: out, align: "middle" } as const
    return { at: { x: end + (negative ? -gap : gap), y: centre.y }, anchor: out, align: "middle" } as const
  }
  const end = negative ? bar.y + bar.height : bar.y
  const start = negative ? bar.y : bar.y + bar.height
  if (position === "center") return { at: centre, anchor: "middle", align: "middle" } as const
  if (position === "insideEnd")
    return {
      at: { x: centre.x, y: end + (negative ? -gap : gap) },
      anchor: "middle",
      align: negative ? "bottom" : "top",
    } as const
  if (position === "insideBase")
    return {
      at: { x: centre.x, y: start + (negative ? gap : -gap) },
      anchor: "middle",
      align: negative ? "top" : "bottom",
    } as const
  return {
    at: { x: centre.x, y: end + (negative ? gap : -gap) },
    anchor: "middle",
    align: negative ? "top" : "bottom",
  } as const
}

function pointLabel(label: CanvasChartLabel, x: number, y: number) {
  if (label.position === "left") return { at: { x: x - gap, y }, anchor: "end", align: "middle" } as const
  if (label.position === "above") return { at: { x, y: y - gap }, anchor: "middle", align: "bottom" } as const
  if (label.position === "below") return { at: { x, y: y + gap }, anchor: "middle", align: "top" } as const
  if (label.position === "center") return { at: { x, y }, anchor: "middle", align: "middle" } as const
  return { at: { x: x + gap, y }, anchor: "start", align: "middle" } as const
}

function totals(chart: CanvasChart): readonly number[] {
  return chart.categories.map((_, at) =>
    chart.series.reduce((sum, series) => sum + Math.abs(series.values[at] ?? 0), 0),
  )
}

function across(
  key: string,
  from: readonly [number, number],
  to: readonly [number, number],
  line: CanvasChartLine,
): ChartShape {
  return { kind: "polyline", key, points: [from, to], line }
}

export function barShapes(chart: CanvasChart, room: ChartBox, manual: boolean): readonly ChartShape[] {
  const valueAxis = chart.valueAxis
  const categoryAxis = chart.categoryAxis
  if (valueAxis === null || categoryAxis === null) return []
  const { plot, shapes } = shrunk(chart, room, manual)
  const horizontal = chart.kind === "bar"
  const count = Math.max(chart.categories.length, 1)
  const span = valueAxis.max - valueAxis.min || 1
  const clamp = (value: number) => Math.min(Math.max(value, valueAxis.min), valueAxis.max)
  const along = (value: number) =>
    horizontal
      ? plot.x + ((clamp(value) - valueAxis.min) / span) * plot.width
      : plot.y + plot.height - ((clamp(value) - valueAxis.min) / span) * plot.height
  const band = (horizontal ? plot.height : plot.width) / count
  const placed = (at: number) => (categoryAxis.reversed ? count - 1 - at : at)
  const bandStart = (at: number) =>
    horizontal ? plot.y + plot.height - (placed(at) + 1) * band : plot.x + placed(at) * band
  const cross = (position: number, key: string, line: CanvasChartLine): ChartShape =>
    horizontal
      ? across(key, [position, plot.y], [position, plot.y + plot.height], line)
      : across(key, [plot.x, position], [plot.x + plot.width, position], line)
  const grid = valueAxis.gridlines
  if (grid !== null) valueAxis.ticks.forEach((tick, at) => shapes.push(cross(along(tick.value), `grid ${at}`, grid)))
  const categoryGrid = categoryAxis.gridlines
  if (categoryGrid !== null) {
    for (let at = 0; at <= count; at += 1) {
      const position = horizontal ? plot.y + at * band : plot.x + at * band
      shapes.push(
        horizontal
          ? across(`category grid ${at}`, [plot.x, position], [plot.x + plot.width, position], categoryGrid)
          : across(`category grid ${at}`, [position, plot.y], [position, plot.y + plot.height], categoryGrid),
      )
    }
  }
  const percent = chart.grouping === "percentStacked"
  const stacked = chart.grouping !== "clustered"
  const sums = totals(chart)
  const scaled = (value: number, at: number) => (percent ? value / (sums[at] || 1) : value)
  const labels: ChartShape[] = []
  if (chart.kind === "line") {
    chart.series.forEach((series, row) => {
      const running = chart.categories.map((_, at) =>
        stacked ? chart.series.slice(0, row).reduce((sum, item) => sum + scaled(item.values[at] ?? 0, at), 0) : 0,
      )
      const points = series.values.map((value, at) =>
        value === null ? null : ([bandStart(at) + band / 2, along(running[at]! + scaled(value, at))] as const),
      )
      let segment: (readonly [number, number])[] = []
      let pieces = 0
      const close = () => {
        if (segment.length > 0 && series.stroke !== null) {
          shapes.push({ kind: "polyline", key: `line ${row} ${pieces}`, points: segment, line: series.stroke })
        }
        pieces += segment.length > 0 ? 1 : 0
        segment = []
      }
      for (const point of points) {
        if (point === null) close()
        else segment.push(point)
      }
      close()
      points.forEach((point, at) => {
        if (point === null) return
        const mark = series.points[at]
        if (series.marker && mark !== undefined) {
          shapes.push({
            kind: "circle",
            key: `marker ${row} ${at}`,
            x: point[0],
            y: point[1],
            r: markerRadius,
            ...mark,
          })
        }
        const label = series.labels[at]
        if (label === null || label === undefined) return
        const spot = pointLabel(label, point[0], point[1])
        labels.push(words(`label ${row} ${at}`, label.text, label.look, spot.at, spot.anchor, spot.align))
      })
    })
  } else {
    const rows = chart.series.length
    const overlap = stacked ? 1 : chart.overlap
    const width = band / (rows - (rows - 1) * overlap + chart.gap)
    const group = stacked ? width : width * (rows - (rows - 1) * overlap)
    const above = chart.categories.map(() => 0)
    const below = chart.categories.map(() => 0)
    const baseline = clamp(0)
    chart.series.forEach((series, row) => {
      series.values.forEach((value, at) => {
        if (value === null) return
        const share = scaled(value, at)
        const from = stacked ? (share < 0 ? below[at]! : above[at]!) : baseline
        const to = stacked ? from + share : share
        if (stacked && share < 0) below[at] = to
        else if (stacked) above[at] = to
        const offset = (band - group) / 2 + (stacked ? 0 : row * width * (1 - overlap))
        const low = Math.min(along(from), along(to))
        const high = Math.max(along(from), along(to))
        const near = bandStart(at) + offset
        const far = bandStart(at) + band - offset - width
        const fromStart = horizontal === categoryAxis.reversed
        const box = horizontal
          ? { x: low, y: fromStart ? near : far, width: high - low, height: width }
          : { x: fromStart ? near : far, y: low, width, height: high - low }
        const mark = series.points[at] ?? { fill: null, line: null }
        shapes.push({ kind: "rect", key: `bar ${row} ${at}`, box, ...mark })
        const label = series.labels[at]
        if (label === null || label === undefined) return
        const spot = labelSpot(label, box, horizontal, share < 0)
        labels.push(words(`label ${row} ${at}`, label.text, label.look, spot.at, spot.anchor, spot.align))
      })
    })
  }
  const baseLine = categoryAxis.shown ? categoryAxis.line : null
  if (baseLine !== null) shapes.push(cross(along(clamp(0)), "category axis", baseLine))
  const sideLine = valueAxis.shown ? valueAxis.line : null
  if (sideLine !== null) {
    shapes.push(
      horizontal
        ? across("value axis", [plot.x, plot.y + plot.height], [plot.x + plot.width, plot.y + plot.height], sideLine)
        : across("value axis", [plot.x, plot.y], [plot.x, plot.y + plot.height], sideLine),
    )
  }
  if (valueAxis.shown && valueAxis.labels) {
    valueAxis.ticks.forEach((tick, at) => {
      const spot = horizontal
        ? { x: along(tick.value), y: plot.y + plot.height + gap }
        : { x: plot.x - gap, y: along(tick.value) }
      shapes.push(
        words(
          `tick ${at}`,
          tick.text,
          valueAxis.look,
          spot,
          horizontal ? "middle" : "end",
          horizontal ? "top" : "middle",
        ),
      )
    })
  }
  if (categoryAxis.shown && categoryAxis.labels) {
    chart.categories.forEach((text, at) => {
      const middle = bandStart(at) + band / 2
      const spot = horizontal ? { x: plot.x - gap, y: middle } : { x: middle, y: plot.y + plot.height + gap }
      shapes.push(
        words(
          `category ${at}`,
          text,
          categoryAxis.look,
          spot,
          horizontal ? "end" : "middle",
          horizontal ? "middle" : "top",
        ),
      )
    })
  }
  return [...shapes, ...labels]
}
