import * as doom from "@airdesign/doom"
import { hitChain } from "@/editor/hit-test"
import type { Point, SlideGeometry } from "@/editor/slide-geometry"

export type GridHit = "number" | "blank" | "element" | "text" | "typing"

export type GridPressed = "slide" | "element" | "editor"

export function gridPress(hit: GridHit, active: boolean, modified: boolean, small = false): GridPressed {
  if (small || hit === "number" || hit === "blank") return "slide"
  if (!active) return "element"
  return hit === "text" && !modified ? "element" : "editor"
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
