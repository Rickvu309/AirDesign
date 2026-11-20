import type { Spot } from "@airdesign/document"
import { guidesAt, nearestLine, type Bounds, type Guide, type SnapTargets, type Watched } from "./snapping.js"

export type SnappedTextDraw = { readonly from: Spot; readonly to: Spot; readonly guides: readonly Guide[] }

const edgesWatched: Watched = { x: ["start", "end"], y: ["start", "end"], spacing: false }

function pointBounds(spot: Spot): Bounds {
  return { left: spot.x, top: spot.y, right: spot.x, bottom: spot.y }
}

function snappedSpot(spot: Spot, targets: SnapTargets, reach: number): Spot {
  const point = pointBounds(spot)
  const across = nearestLine(point, targets, "x", ["start"], reach)
  const down = nearestLine(point, targets, "y", ["start"], reach)
  return { x: spot.x + (across?.offset ?? 0), y: spot.y + (down?.offset ?? 0) }
}

export function snappedTextDraw(
  from: Spot,
  to: Spot,
  targets: SnapTargets,
  reach: number,
  free: boolean,
): SnappedTextDraw {
  if (free) return { from, to, guides: [] }
  const start = snappedSpot(from, targets, reach)
  const end = snappedSpot(to, targets, reach)
  const drawn = {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  }
  return { from: start, to: end, guides: guidesAt(drawn, targets, edgesWatched) }
}
