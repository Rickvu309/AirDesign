import { resizeCursor, rotateCursor, type ResizeGrip } from "./transform-math"
import type { Frame } from "./selection-frame"
import { ScreenSized, screenLine } from "./screen-sized"
import { sizeLabelCentre, sizeLabelHeight } from "./size-label-place"
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

const origin: Point = { x: 0, y: 0 }

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
  const base = { x: (screen[2].x + screen[3].x) / 2, y: (screen[2].y + screen[3].y) / 2 }
  const below = sizeLabelCentre(screen, middle)
  const pill = label.length * 6.4 + 14
  return (
    <g data-handles="">
      {corners.map((name, at) => {
        const point = screen[at]!
        const out = toward(origin, { x: point.x - middle.x, y: point.y - middle.y }, reach)
        return (
          <ScreenSized key={name} at={point}>
            <circle
              data-grip={`rotate-${name}`}
              cx={out.x}
              cy={out.y}
              r={reach}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: rotateCursor(name, frame.rotation) }}
            />
          </ScreenSized>
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
            style={{
              ...screenLine(grab),
              pointerEvents: "stroke",
              cursor: resizeCursor(grip as ResizeGrip, frame.rotation),
            }}
          />
        )
      })}
      {corners.map((name, at) => {
        return (
          <ScreenSized key={name} at={screen[at]!} turn={frame.rotation}>
            <rect
              data-grip={name}
              x={-grab / 2}
              y={-grab / 2}
              width={grab}
              height={grab}
              fill="white"
              stroke={edge}
              strokeWidth={1}
              style={{ pointerEvents: "all", cursor: resizeCursor(name, frame.rotation) }}
            />
          </ScreenSized>
        )
      })}
      <ScreenSized at={base}>
        <g data-size-label="" transform={`translate(${String(below.x - base.x)} ${String(below.y - base.y)})`}>
          <rect x={-pill / 2} y={-sizeLabelHeight / 2} width={pill} height={sizeLabelHeight} rx={4} fill={edge} />
          <text x={0} y={4} textAnchor="middle" fontSize={11} fill="white">
            {label}
          </text>
        </g>
      </ScreenSized>
    </g>
  )
}
