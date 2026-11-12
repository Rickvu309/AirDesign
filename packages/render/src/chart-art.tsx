import { chartLayout } from "./chart-layout.js"
import type { CanvasChart, CanvasChartLine } from "./chart-record.js"
import { lineHeight, type ChartShape } from "./chart-shape.js"
import type { PaintBox } from "./paint-box.js"
import { familyOf, type Scaled } from "./text-look.js"

const emuPerPoint = 12_700
const ascent = 0.8
const middleShift = 0.35
const descent = 0.25
const pageInk = "black"

const kindNames = {
  pie: "Pie chart",
  doughnut: "Doughnut chart",
  bar: "Bar chart",
  column: "Column chart",
  line: "Line chart",
} as const

export function chartName(chart: CanvasChart): string {
  const kind = kindNames[chart.kind]
  return chart.title === null || chart.title.text.trim() === ""
    ? kind
    : `${kind}: ${chart.title.text.replace(/\n/g, " ")}`
}

function stroke(line: CanvasChartLine | null) {
  return line === null ? { stroke: "none" } : { stroke: line.color, strokeWidth: line.width }
}

function Drawn(props: { readonly shape: ChartShape }) {
  const { shape } = props
  if (shape.kind === "path") return <path d={shape.d} fill={shape.fill ?? "none"} {...stroke(shape.line)} />
  if (shape.kind === "rect") {
    const { box } = shape
    return (
      <rect
        fill={shape.fill ?? "none"}
        height={box.height}
        width={box.width}
        x={box.x}
        y={box.y}
        {...stroke(shape.line)}
      />
    )
  }
  if (shape.kind === "circle")
    return <circle cx={shape.x} cy={shape.y} fill={shape.fill ?? "none"} r={shape.r} {...stroke(shape.line)} />
  if (shape.kind === "polyline") {
    return (
      <polyline
        fill="none"
        points={shape.points.map(([x, y]) => `${x},${y}`).join(" ")}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...stroke(shape.line)}
      />
    )
  }
  const { look } = shape
  const step = look.size * lineHeight
  const count = shape.lines.length
  const first =
    shape.align === "top"
      ? look.size * ascent
      : shape.align === "middle"
        ? look.size * middleShift - ((count - 1) * step) / 2
        : -look.size * descent - (count - 1) * step
  return (
    <text
      data-chart-text={shape.key}
      fill={look.color ?? pageInk}
      fontFamily={familyOf(look.font)}
      fontSize={look.size}
      fontWeight={look.bold ? 700 : 400}
      textAnchor={shape.anchor}
      textRendering="geometricPrecision"
      {...(shape.turn === 0 ? {} : { transform: `rotate(${shape.turn} ${shape.x} ${shape.y})` })}
    >
      {shape.lines.map((line, at) => (
        <tspan key={at} dy={at === 0 ? first : step} x={shape.x} y={at === 0 ? shape.y : undefined}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function chartData(chart: CanvasChart): string {
  return chart.series
    .map((series) => {
      const pairs = chart.categories.map((category, at) => `${category} ${series.texts[at] ?? ""}`.trim())
      return `${series.name}: ${pairs.join("; ")}.`
    })
    .join(" ")
}

export function ChartArt(props: {
  readonly chart: CanvasChart | undefined
  readonly box: PaintBox | null
  readonly scaled: Scaled
  readonly described: boolean
}) {
  const { box, chart, described, scaled } = props
  if (chart === undefined || box === null) return null
  const width = box.width / emuPerPoint
  const height = box.height / emuPerPoint
  const name = chartName(chart)
  return (
    <svg
      aria-hidden={described ? undefined : true}
      aria-label={described ? name : undefined}
      data-chart={chart.kind}
      height={scaled(box.height)}
      role={described ? "img" : undefined}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", userSelect: "none" }}
      viewBox={`0 0 ${width} ${height}`}
      width={scaled(box.width)}
    >
      {described ? <desc>{chartData(chart)}</desc> : null}
      {chartLayout(chart, width, height).map((shape) => (
        <Drawn key={shape.key} shape={shape} />
      ))}
    </svg>
  )
}
