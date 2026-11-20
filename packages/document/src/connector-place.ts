import { registerScope, type ScopedElement } from "./change.js"
import { drawnShape } from "./element-outline.js"
import { outlineOf, routed, routedPresets, siteKinds, siteTie, type Bound, type Routed, type Tie } from "./connector.js"
import { landedPatch, type Register } from "./decide.js"
import { addedGeometry } from "./element-order.js"
import { readElementId, shapeOf, type ElementId } from "./element-id.js"
import { openingPlace, placeOf, type Place } from "./group-place.js"
import { followsGroups, shownPlace } from "./group-space.js"
import type { IndexElement } from "./deck-index.js"
import { openingElement } from "./slide-floor.js"

type Side = "start" | "end"

const sides: readonly Side[] = ["start", "end"]

const shownBound = /^(\S+) site (\d+)$/

function landedOf(register: Register, node: ElementId) {
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  return body === undefined ? {} : landedPatch(body, "text")
}

function openingEnd(opening: IndexElement | undefined, side: Side): Bound | null {
  const shown = opening?.design?.[`connection.${side}`]?.[0]
  const found = typeof shown === "string" ? shownBound.exec(shown) : null
  const node = found?.[1] === undefined ? undefined : readElementId(found[1])
  return node === undefined || found?.[2] === undefined ? null : { node, site: Number(found[2]) }
}

function endNow(register: Register, node: ElementId, side: Side): Bound | null {
  const edit = landedOf(register, node).connection?.[side]
  if (typeof edit !== "object") return openingEnd(openingElement(register, node), side)
  return "shape" in edit.set ? edit.set.shape : null
}

function shapeAt(register: Register, node: ElementId, now: boolean) {
  const rows = now ? landedOf(register, node).geometry : undefined
  return drawnShape(rows, openingElement(register, node), addedGeometry(register, node))
}

function drawn(register: Register, node: ElementId, connector: boolean, now: boolean): string {
  const opening = openingElement(register, node)
  const place = now ? placeOf(register, node) : openingPlace(opening)
  const ends = sides.map((side) => (!connector ? null : now ? endNow(register, node, side) : openingEnd(opening, side)))
  return JSON.stringify([place, shapeAt(register, node, now), ends])
}

function readPlace(register: Register, node: ElementId): Place | null {
  return followsGroups(register, node) ? shownPlace(register, node) : placeOf(register, node)
}

function tieOf(register: Register, view: ScopedElement, target: ScopedElement | undefined, end: Bound | null) {
  if (end === null || target === undefined || !siteKinds.includes(target.facts.kind)) return null
  if ((target.parent ?? null) !== (view.parent ?? null)) return null
  const shaped = shapeAt(register, target.node, true)
  const outline = outlineOf(shaped?.preset ?? null, shaped?.adjust ?? {})
  const spot = readPlace(register, target.node)
  return outline === null || spot === null ? null : siteTie(spot, outline, end.site)
}

export function followedPlace(register: Register, node: ElementId): Routed | null {
  if (openingElement(register, node)?.kind !== "connector") return null
  const shaped = shapeAt(register, node, true)
  if (shaped === null || !routedPresets.includes(shaped.preset)) return null
  const scope = registerScope(register)
  const view = scope.view(node)
  if (view === undefined) return null
  const ends = sides.map((side) => endNow(register, node, side))
  const targets = ends.map((end) => {
    const target = end === null ? undefined : scope.view(end.node)
    return target === undefined || shapeOf(target.node).slide !== shapeOf(node).slide ? undefined : target
  })
  const moved = [view, ...targets].some(
    (each, at) =>
      each !== undefined && drawn(register, each.node, at === 0, true) !== drawn(register, each.node, at === 0, false),
  )
  const place = moved ? readPlace(register, node) : null
  if (place === null) return null
  const ties = ends.map((end, at): Tie | null => tieOf(register, view, targets[at], end))
  return routed(place, shaped.preset, shaped.adjust, ties[0] ?? null, ties[1] ?? null)
}
