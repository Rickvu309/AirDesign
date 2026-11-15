import {
  connectorEnds,
  outlineOf,
  siteCount,
  siteKinds,
  sitePoint,
  type ElementId,
  type Place,
  type Spot,
} from "@airdesign/document"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"

export type End = "start" | "end"

export type Aim = { readonly node: ElementId; readonly sites: readonly Spot[]; readonly site: number | null }

const turn = 60_000

export function paintPlace(box: PaintBox): Place {
  return {
    box: { x: box.x, y: box.y, cx: box.width, cy: box.height },
    rot: Math.round(box.rotation * turn),
    flipH: box.flipH,
    flipV: box.flipV,
  }
}

export function endsOf(box: PaintBox): Readonly<Record<End, Spot>> {
  return connectorEnds(paintPlace(box))
}

export function sitesOf(element: CanvasElement, box: PaintBox): readonly Spot[] {
  const outline = outlineOf(element.geometry?.preset ?? null, element.geometry?.adjusts ?? {})
  if (outline === null) return []
  const place = paintPlace(box)
  return Array.from({ length: siteCount(outline.preset) }, (_, site) => sitePoint(place, outline, site)).filter(
    (spot) => spot !== null,
  )
}

function inside(box: PaintBox, at: Spot, reach: number): boolean {
  const angle = (-box.rotation * Math.PI) / 180
  const dx = at.x - (box.x + box.width / 2)
  const dy = at.y - (box.y + box.height / 2)
  const across = dx * Math.cos(angle) - dy * Math.sin(angle)
  const down = dx * Math.sin(angle) + dy * Math.cos(angle)
  return Math.abs(across) <= box.width / 2 + reach && Math.abs(down) <= box.height / 2 + reach
}

export function aimAt(
  elements: readonly CanvasElement[],
  connector: CanvasElement,
  at: Spot,
  reach: number,
  placed: (element: CanvasElement) => PaintBox | null,
): Aim | null {
  const under = elements.toReversed().flatMap((each): Aim[] => {
    if (each.id === null || each.id === connector.id || !siteKinds.includes(each.kind)) return []
    if (each.group?.id !== connector.group?.id) return []
    const box = placed(each)
    if (box === null || !inside(box, at, reach)) return []
    const sites = sitesOf(each, box)
    return sites.length === 0 ? [] : [{ node: each.id, sites, site: null }]
  })
  const nearest = under
    .flatMap((aim) => aim.sites.map((spot, site) => ({ aim, site, far: Math.hypot(spot.x - at.x, spot.y - at.y) })))
    .filter((each) => each.far <= reach)
    .toSorted((left, right) => left.far - right.far)[0]
  return nearest === undefined ? (under[0] ?? null) : { ...nearest.aim, site: nearest.site }
}
