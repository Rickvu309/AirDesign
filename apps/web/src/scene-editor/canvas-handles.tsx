import { resizeCursor, rotateCursor, type ResizeGrip } from "@airdesign/render"
import type { Frame } from "./selection-frame"
import type { Point } from "./slide-geometry"

const corners = ["top-left", "top-right", "bottom-right", "bottom-left"] as const
const edges = [
  { grip: "top", from: 0, to: 1 },
  { grip: "right", from: 1, to: 2 },
  { grip: "bottom", from: 2, to: 3 },
  { grip: "left", from: 3, to: 0 },
] as const

const edge = "var(--primary-strong)"
const grab = 8
const reach = 12

function toward(from: Point, to: Point, by: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
  return { x: from.x + ((to.x - from.x) / length) * by, y: from.y + ((to.y - from.y) / length) * by }
}

export function CanvasHandles({
  frame,
  scale,
  label,
}: {
  readonly frame: Frame
  readonly scale: number
  readonly label: string
}) {
  const screen = frame.corners.map((corner) => ({ x: corner.x * scale, y: corner.y * scale })) as unknown as readonly [
    Point,
    Point,
    Point,
    Point,
  ]
  const middle = { x: frame.center.x * scale, y: frame.center.y * scale }
  const below = toward(
    { x: (screen[2].x + screen[3].x) / 2, y: (screen[2].y + screen[3].y) / 2 },
    { x: (screen[2].x + screen[3].x) / 1 - middle.x, y: (screen[2].y + screen[3].y) / 1 - middle.y },
    22,
  )
  const pill = label.length * 6.4 + 14
  return (
    <g data-handles="">
      {corners.map((name, at) => {
        const point = screen[at]!
        const out = toward(middle, point, Math.hypot(point.x - middle.x, point.y - middle.y) + reach)
        return (
          <circle
            key={name}
            data-grip={`rotate-${name}`}
            cx={out.x}
            cy={out.y}
            r={reach}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: rotateCursor(name, frame.rotation) }}
          />
        )
      })}
      {edges.map(({ grip, from, to }) => {
        const start = toward(screen[from]!, screen[to]!, grab)
        const end = toward(screen[to]!, screen[from]!, grab)
        return (
          <line
            key={grip}
            data-grip={grip}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="transparent"
            strokeWidth={grab}
            style={{ pointerEvents: "stroke", cursor: resizeCursor(grip as ResizeGrip, frame.rotation) }}
          />
        )
      })}
      {corners.map((name, at) => {
        const point = screen[at]!
        return (
          <rect
            key={name}
            data-grip={name}
            x={point.x - grab / 2}
            y={point.y - grab / 2}
            width={grab}
            height={grab}
            fill="white"
            stroke={edge}
            strokeWidth={1}
            transform={`rotate(${String(frame.rotation)} ${String(point.x)} ${String(point.y)})`}
            style={{ pointerEvents: "all", cursor: resizeCursor(name, frame.rotation) }}
          />
        )
      })}
      <g data-size-label="" transform={`translate(${String(below.x)} ${String(below.y)})`}>
        <rect x={-pill / 2} y={-9} width={pill} height={18} rx={4} fill={edge} />
        <text x={0} y={4} textAnchor="middle" fontSize={11} fill="white">
          {label}
        </text>
      </g>
    </g>
  )
}
