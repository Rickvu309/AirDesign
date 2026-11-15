import type { Box } from "./box.js"
import type { ElementId } from "./element-id.js"
import type { Place } from "./group-place.js"
import { siteSpot, type Spot } from "./preset-sites.js"
import { presetAdjusts, type Preset } from "./trait-geometry.js"

export type Outline = { readonly preset: Preset; readonly adjust: Readonly<Record<string, number>> }

export type Bound = { readonly node: ElementId; readonly site: number }

export const siteKinds: readonly string[] = ["shape", "picture"]

export const routedPresets: readonly string[] = [
  "line",
  "straightConnector1",
  "bentConnector2",
  "bentConnector3",
  "bentConnector4",
  "bentConnector5",
  "curvedConnector2",
  "curvedConnector3",
  "curvedConnector4",
  "curvedConnector5",
]

const turn = Math.PI / 10_800_000

function turned(spot: Spot, rot: number, back: boolean): Spot {
  const angle = (back ? -rot : rot) * turn
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: spot.x * cos - spot.y * sin, y: spot.x * sin + spot.y * cos }
}

function centre(box: Box): Spot {
  return { x: box.x + box.cx / 2, y: box.y + box.cy / 2 }
}

function rounded(spot: Spot): Spot {
  return { x: Math.round(spot.x), y: Math.round(spot.y) }
}

export function outlineOf(preset: string | null, adjust: Readonly<Record<string, number>>): Outline | null {
  if (preset === null) return { preset: "rect", adjust: {} }
  const found = Object.hasOwn(presetAdjusts, preset) ? (preset as Preset) : undefined
  return found === undefined ? null : { preset: found, adjust }
}

export function sitePoint(target: Place, outline: Outline, site: number): Spot | null {
  const { box } = target
  const local = siteSpot(outline.preset, box.cx, box.cy, outline.adjust, site)
  if (local === null) return null
  const x = target.flipH ? box.cx - local.x : local.x
  const y = target.flipV ? box.cy - local.y : local.y
  const offset = turned({ x: x - box.cx / 2, y: y - box.cy / 2 }, target.rot, false)
  const middle = centre(box)
  return rounded({ x: middle.x + offset.x, y: middle.y + offset.y })
}

export function connectorEnds(connector: Place): { readonly start: Spot; readonly end: Spot } {
  const { box } = connector
  const half = turned(
    { x: (connector.flipH ? -box.cx : box.cx) / 2, y: (connector.flipV ? -box.cy : box.cy) / 2 },
    connector.rot,
    false,
  )
  const middle = centre(box)
  return {
    start: rounded({ x: middle.x - half.x, y: middle.y - half.y }),
    end: rounded({ x: middle.x + half.x, y: middle.y + half.y }),
  }
}

export function route(connector: Place, start: Spot, end: Spot): Place {
  const local = turned({ x: end.x - start.x, y: end.y - start.y }, connector.rot, true)
  const cx = Math.round(Math.abs(local.x))
  const cy = Math.round(Math.abs(local.y))
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
  return {
    box: { x: Math.round(middle.x - cx / 2), y: Math.round(middle.y - cy / 2), cx, cy },
    rot: connector.rot,
    flipH: local.x < 0,
    flipV: local.y < 0,
  }
}

export function routedPlace(connector: Place, preset: string, start: Spot | null, end: Spot | null): Place | null {
  if (!routedPresets.includes(preset) || (start === null && end === null)) return null
  const ends = connectorEnds(connector)
  return route(connector, start ?? ends.start, end ?? ends.end)
}
