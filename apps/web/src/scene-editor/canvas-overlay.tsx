import type { scene } from "@airdesign/document"
import type { Guide } from "@airdesign/render"
import type { Rect } from "./selection"
import { aroundPlaced, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

export type Preview = { readonly writes: readonly scene.Write[]; readonly guides: readonly Guide[] }

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

export function CanvasOverlay(props: {
  readonly geometry: SlideGeometry
  readonly selected: readonly scene.NodeId[]
  readonly hovered: scene.NodeId | null
  readonly marquee: Rect | null
  readonly guides: readonly Guide[]
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
}) {
  const { geometry, selected, hovered, marquee, guides, scale, size } = props
  const chosen = selected.flatMap((id) => geometry.byId.get(id) ?? [])
  const all = aroundPlaced(chosen)
  const hover = hovered === null || selected.includes(hovered) ? undefined : geometry.byId.get(hovered)
  return (
    <svg
      data-canvas-overlay=""
      width={size.w * scale}
      height={size.h * scale}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {hover === undefined ? null : (
        <polygon data-hover-outline="" points={polygon(hover, scale)} fill="none" stroke={edge} strokeWidth={1} />
      )}
      {chosen.map((placed) => (
        <polygon
          key={placed.id}
          data-selection-outline={placed.id}
          points={polygon(placed, scale)}
          fill="none"
          stroke={edge}
          strokeWidth={1}
        />
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
