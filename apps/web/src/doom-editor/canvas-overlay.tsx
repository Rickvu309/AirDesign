import * as doom from "@airdesign/doom"
import type { Guide } from "@airdesign/render"
import type { Rect } from "./selection"
import { CanvasHandles } from "./canvas-handles"
import { LineHandles } from "./line-handles"
import { attachedEnds, lineEnds, type Aim } from "./line-end-drag"
import { framed } from "./selection-frame"
import { apply, aroundPlaced, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

export type Preview = {
  readonly kind: "move" | "transform" | "draw" | "end"
  readonly writes: readonly doom.Write[]
  readonly guides: readonly Guide[]
  readonly label: string | null
  readonly aim?: Aim | null
}

const edge = "var(--primary-strong)"
const alert = "var(--limit)"

function polygon(placed: Placed, scale: number): string {
  return placed.corners.map((corner) => `${String(corner.x * scale)},${String(corner.y * scale)}`).join(" ")
}

function GuideMarks({ guide, scale }: { readonly guide: Guide; readonly scale: number }) {
  if (guide.kind === "snap") {
    const vertical = guide.axis === "x"
    const line = vertical
      ? { x1: guide.at * scale, x2: guide.at * scale, y1: guide.from * scale, y2: guide.to * scale }
      : { y1: guide.at * scale, y2: guide.at * scale, x1: guide.from * scale, x2: guide.to * scale }
    return (
      <g stroke={alert} strokeWidth={1}>
        <line {...line} />
        {guide.marks.map((mark) => {
          const at: Point = vertical ? { x: guide.at, y: mark } : { x: mark, y: guide.at }
          const x = at.x * scale
          const y = at.y * scale
          return (
            <path
              key={mark}
              d={`M${String(x - 3)},${String(y - 3)}L${String(x + 3)},${String(y + 3)}M${String(x - 3)},${String(y + 3)}L${String(x + 3)},${String(y - 3)}`}
            />
          )
        })}
      </g>
    )
  }
  const vertical = guide.axis === "y"
  const line = vertical
    ? { x1: guide.across * scale, x2: guide.across * scale, y1: guide.from * scale, y2: guide.to * scale }
    : { y1: guide.across * scale, y2: guide.across * scale, x1: guide.from * scale, x2: guide.to * scale }
  return (
    <g stroke={alert} strokeWidth={1}>
      <line {...line} />
    </g>
  )
}

function routeOf(placed: Placed, scale: number): string | null {
  const geometry = placed.node.geometry
  if (geometry?.kind !== "line") return null
  const [first, ...rest] = geometry.points.map((point) => apply(placed.matrix, point))
  if (first === undefined) return null
  const spot = (point: Point) => `${String(point.x * scale)} ${String(point.y * scale)}`
  const tail =
    geometry.route === "curve" && rest.length === 3
      ? `C${rest.map(spot).join(" ")}`
      : rest.map((point) => `L${spot(point)}`).join("")
  return `M${spot(first)}${tail}`
}

function Outline({
  placed,
  scale,
  ...marks
}: {
  readonly placed: Placed
  readonly scale: number
  readonly "data-hover-outline"?: string
  readonly "data-selection-outline"?: string
}) {
  const route = routeOf(placed, scale)
  return route === null ? (
    <polygon {...marks} points={polygon(placed, scale)} fill="none" stroke={edge} strokeWidth={1} />
  ) : (
    <path {...marks} d={route} fill="none" stroke={edge} strokeWidth={1} />
  )
}

export function CanvasOverlay(props: {
  readonly view: doom.Doom
  readonly preview: Preview | null
  readonly geometry: SlideGeometry
  readonly selected: readonly doom.NodeId[]
  readonly hovered: doom.NodeId | null
  readonly marquee: Rect | null
  readonly editing: boolean
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
}) {
  const { view, preview, geometry, selected, hovered, marquee, scale, size } = props
  const guides = preview?.guides ?? []
  const frame =
    preview?.kind === "move" || preview?.kind === "draw" || props.editing ? null : framed(geometry, selected, view)
  const chosen = selected.flatMap((id) => geometry.byId.get(id) ?? [])
  const [lone] = chosen
  const ends =
    chosen.length === 1 && lone !== undefined && preview?.kind !== "move" && !props.editing ? lineEnds(lone) : null
  const all = aroundPlaced(chosen)
  const hover = hovered === null || selected.includes(hovered) ? undefined : geometry.byId.get(hovered)
  return (
    <svg
      data-canvas-overlay=""
      width={size.w * scale}
      height={size.h * scale}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {hover === undefined ? null : <Outline placed={hover} scale={scale} data-hover-outline="" />}
      {chosen.map((placed) => (
        <Outline key={placed.id} placed={placed} scale={scale} data-selection-outline={placed.id} />
      ))}
      {chosen.length > 1 && all !== null ? (
        <rect
          data-selection-frame=""
          x={all.left * scale}
          y={all.top * scale}
          width={(all.right - all.left) * scale}
          height={(all.bottom - all.top) * scale}
          fill="none"
          stroke={edge}
          strokeWidth={1}
        />
      ) : null}
      {frame === null ? null : (
        <CanvasHandles
          frame={frame}
          scale={scale}
          label={preview?.label ?? `${String(Math.round(frame.w))} × ${String(Math.round(frame.h))}`}
        />
      )}
      {ends === null ? null : (
        <LineHandles ends={ends} attached={attachedEnds(view, lone?.id)} aim={preview?.aim ?? null} scale={scale} />
      )}
      {guides.map((guide, at) => (
        <GuideMarks key={at} guide={guide} scale={scale} />
      ))}
      {marquee === null ? null : (
        <rect
          data-marquee=""
          x={marquee.left * scale}
          y={marquee.top * scale}
          width={(marquee.right - marquee.left) * scale}
          height={(marquee.bottom - marquee.top) * scale}
          fill="var(--primary-15)"
          stroke={edge}
          strokeWidth={1}
        />
      )}
    </svg>
  )
}
