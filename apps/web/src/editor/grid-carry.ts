import type * as doom from "@airdesign/doom"
import type { CarryOver } from "@/editor/canvas-carry"
import type { GridCard } from "@/editor/grid-lines"
import type { Point, SlideGeometry } from "@/editor/slide-geometry"

export function carryOver(
  cards: readonly GridCard[],
  home: string,
  at: Point,
  geometries: ReadonlyMap<doom.NodeId, SlideGeometry>,
): CarryOver {
  const from = cards.find((card) => card.id === home)
  if (from === undefined) return { kind: "none" }
  const world = { x: from.left + at.x, y: from.top + at.y }
  const under = cards.find(
    (card) =>
      world.x >= card.left &&
      world.x <= card.left + card.width &&
      world.y >= card.top &&
      world.y <= card.top + card.height,
  )
  if (under === undefined) return { kind: "none" }
  if (under.id === home) return { kind: "home" }
  return {
    kind: "slide",
    slide: under.id,
    offset: { x: under.left - from.left, y: under.top - from.top },
    geometry: geometries.get(under.id) ?? null,
  }
}
