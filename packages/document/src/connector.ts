import type { Box } from "./box.js"
import type { ElementId } from "./element-id.js"
import type { Place } from "./group-place.js"
import { siteSpot, type Spot } from "./preset-sites.js"
import { presetAdjusts, type Preset } from "./trait-geometry.js"

export type Outline = { readonly preset: Preset; readonly adjust: Readonly<Record<string, number>> }

export type Bound = { readonly node: ElementId; readonly site: number }

export type Tie = { readonly spot: Spot; readonly way: Spot }

export type Routed = { readonly place: Place; readonly adjust: Readonly<Record<string, number>> }

type Elbow = { readonly segments: number; readonly adjusts: readonly string[] }

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

const elbows: Readonly<Record<string, Elbow>> = {
  bentConnector2: { segments: 2, adjusts: [] },
  bentConnector3: { segments: 3, adjusts: ["adj1"] },
  bentConnector4: { segments: 4, adjusts: ["adj1", "adj2"] },
  bentConnector5: { segments: 5, adjusts: ["adj1", "adj2", "adj3"] },
  curvedConnector2: { segments: 2, adjusts: [] },
  curvedConnector3: { segments: 3, adjusts: ["adj1"] },
  curvedConnector4: { segments: 4, adjusts: ["adj1", "adj2"] },
  curvedConnector5: { segments: 5, adjusts: ["adj1", "adj2", "adj3"] },
}

export const elbowClearance = 228_600

const turn = Math.PI / 10_800_000
const quarter = 5_400_000
const half = 50_000
const whole = 100_000
const guideLimit = 2_147_483_647

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

function axis(spot: Spot): Spot {
  return Math.abs(spot.x) >= Math.abs(spot.y) ? { x: Math.sign(spot.x), y: 0 } : { x: 0, y: Math.sign(spot.y) }
}

function sideOf(local: Spot, cx: number, cy: number): Spot {
  const across = Math.min(local.x, cx - local.x)
  const down = Math.min(local.y, cy - local.y)
  if (across < down) return { x: local.x < cx - local.x ? -1 : 1, y: 0 }
  return { x: 0, y: local.y < cy - local.y ? -1 : 1 }
}

export function siteTie(target: Place, outline: Outline, site: number): Tie | null {
  const { box } = target
  const local = siteSpot(outline.preset, box.cx, box.cy, outline.adjust, site)
  const spot = sitePoint(target, outline, site)
  if (local === null || spot === null) return null
  const side = sideOf(local, box.cx, box.cy)
  const mirrored = { x: target.flipH ? -side.x : side.x, y: target.flipV ? -side.y : side.y }
  return { spot, way: axis(turned(mirrored, target.rot, false)) }
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

function elbowTurn(connector: Place, elbow: Elbow, from: Spot, to: Spot, start: Spot | null, end: Spot | null) {
  const heading = turned({ x: 1, y: 0 }, connector.rot, false)
  const across =
    start !== null
      ? start.x !== 0
      : end !== null
        ? (end.x !== 0) === (elbow.segments % 2 === 1)
        : Math.abs(heading.x) >= Math.abs(heading.y)
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (across) return (start?.x ?? Math.sign(dx || 1)) > 0 ? 0 : 2 * quarter
  return (dx > 0 && dy < 0) || (dx < 0 && dy > 0) ? quarter : 3 * quarter
}

function localWay(place: Place, way: Spot | null): Spot | null {
  if (way === null) return null
  const back = axis(turned(way, place.rot, true))
  return { x: place.flipH ? -back.x : back.x, y: place.flipV ? -back.y : back.y }
}

function fraction(part: number, size: number): number {
  const value = Math.round((part * whole) / (size === 0 ? 1 : size))
  return Math.min(Math.max(value, -guideLimit), guideLimit)
}

function elbowAdjust(place: Place, elbow: Elbow, start: Spot | null, end: Spot | null): Record<string, number> {
  const { cx: w, cy: h } = place.box
  const leaves = localWay(place, start)
  const arrives = localWay(place, end)
  const out = leaves === null || leaves.x === 0 ? 1 : leaves.x
  const back = arrives === null || arrives.x === 0 ? -1 : arrives.x
  const below = arrives === null || arrives.y === 0 ? -1 : arrives.y
  const past = fraction(w + elbowClearance, w)
  const before = fraction(-elbowClearance, w)
  const first = out < 0 ? before : back > 0 ? past : half
  const values: Readonly<Record<number, readonly number[]>> = {
    3: [out > 0 && back > 0 ? past : out < 0 && back < 0 ? before : half],
    4: [out < 0 ? before : half, below > 0 ? fraction(h + elbowClearance, h) : half],
    5: [first, half, back > 0 ? past : out < 0 ? before : half],
  }
  const chosen = values[elbow.segments] ?? []
  return Object.fromEntries(elbow.adjusts.map((name, at) => [name, chosen[at] ?? half]))
}

export function routed(
  connector: Place,
  preset: string,
  adjust: Readonly<Record<string, number>>,
  start: Tie | null,
  end: Tie | null,
): Routed | null {
  if (!routedPresets.includes(preset) || (start === null && end === null)) return null
  const ends = connectorEnds(connector)
  const from = start?.spot ?? ends.start
  const to = end?.spot ?? ends.end
  const elbow = elbows[preset]
  if (elbow === undefined) return { place: route(connector, from, to), adjust }
  const ways = { start: start?.way ?? null, end: end?.way ?? null }
  const rot = elbowTurn(connector, elbow, from, to, ways.start, ways.end)
  const place = route({ ...connector, rot }, from, to)
  return { place, adjust: elbow.adjusts.length === 0 ? adjust : elbowAdjust(place, elbow, ways.start, ways.end) }
}
