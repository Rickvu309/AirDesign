import type { LayoutGuide } from "@airdesign/document"
import type { CSSProperties } from "react"
import { gridLines, layoutBands } from "./layout-guide-lines.js"
import type { Scaled } from "./text-look.js"

const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }

function crisp(pixels: number): number {
  return Math.round(pixels) + 0.5
}

function GuideShapes(props: {
  readonly guide: LayoutGuide
  readonly width: number
  readonly height: number
  readonly scaled: Scaled
}) {
  const { guide, width, height, scaled } = props
  if (guide.pattern === "grid") {
    const across = gridLines(guide.size, width).map((at) => `M${String(crisp(scaled(at)))},0V${String(scaled(height))}`)
    const down = gridLines(guide.size, height).map((at) => `M0,${String(crisp(scaled(at)))}H${String(scaled(width))}`)
    return (
      <path
        data-layout-guide="grid"
        d={[...across, ...down].join("")}
        fill="none"
        stroke={`#${guide.color}`}
        strokeOpacity={guide.opacity / 100}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
    )
  }
  const columns = guide.pattern === "columns"
  return (
    <g data-layout-guide={guide.pattern} fill={`#${guide.color}`} fillOpacity={guide.opacity / 100}>
      {layoutBands(guide, columns ? width : height).map(([start, end]) =>
        columns ? (
          <rect key={start} x={scaled(start)} y={0} width={scaled(end - start)} height={scaled(height)} />
        ) : (
          <rect key={start} x={0} y={scaled(start)} width={scaled(width)} height={scaled(end - start)} />
        ),
      )}
    </g>
  )
}

export function LayoutGuidePaint(props: {
  readonly guides: readonly LayoutGuide[]
  readonly width: number
  readonly height: number
  readonly scaled: Scaled
}) {
  const { guides, width, height, scaled } = props
  const shown = guides.filter((guide) => guide.shown)
  if (shown.length === 0) return null
  return (
    <svg aria-hidden="true" data-layout-guides={shown.length} width="100%" height="100%" style={layer}>
      {shown.map((guide, index) => (
        <GuideShapes key={index} guide={guide} width={width} height={height} scaled={scaled} />
      ))}
    </svg>
  )
}
