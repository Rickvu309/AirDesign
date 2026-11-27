import * as doom from "@airdesign/doom"
import { hitChain } from "@/editing/hit-test"
import type { Point, SlideGeometry } from "@/editing/slide-geometry"

export type GridPart = "number" | "live" | "picture"

export type GridRoute = "slide" | "edit" | "canvas"

export function gridRoute(part: GridPart, element: boolean, small: boolean): GridRoute {
  if (part === "number" || small) return "slide"
  if (part === "live") return "canvas"
  return element ? "edit" : "slide"
}

export function elementAt(
  geometry: SlideGeometry,
  at: Point,
  reach: number,
  locked: (id: doom.NodeId) => boolean,
): doom.NodeId | null {
  const leaf = hitChain(geometry.roots, at, reach, locked)?.at(-1)
  return leaf === undefined ? null : leaf.id
}

export function gridEntryOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null
  const entry = target.closest("[data-grid-card]")?.querySelector("[data-slide-entry]")
  const number = Number(entry?.getAttribute("data-slide-entry"))
  return Number.isInteger(number) && number > 0 ? number - 1 : null
}
