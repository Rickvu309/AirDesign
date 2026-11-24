import { adjustDefaults, presetSites } from "@airdesign/doom"
import { presetAdjusts, type Box, type Outline, type Place, type Spot, type Tie } from "@airdesign/document"

type Preset = Outline["preset"]

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

function sitesOf(preset: Preset, width: number, height: number, adjust: Readonly<Record<string, number>>) {
  if (preset === "line")
    return [
      { x: 0, y: 0 },
      { x: width, y: height },
    ]
  if (preset === "rect" || preset === "ellipse") return presetSites({ kind: preset }, width, height)
  const named = Object.entries(adjustDefaults(preset)).map(([name, value]) => adjust[name] ?? value)
  return presetSites({ kind: "preset", name: preset, adjust: named }, width, height)
}

export function siteSpot(
  preset: Preset,
  width: number,
  height: number,
  adjust: Readonly<Record<string, number>>,
  site: number,
): Spot | null {
  return sitesOf(preset, width, height, adjust)[site] ?? null
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
