import { gridRinged, gridPick, type GridInteraction, type GridStep } from "@/editor/grid-interaction"
import { prunedPick } from "@/editor/grid-selection"
import type { GridRect } from "@/editor/grid-lines"

type MarqueePoint = { readonly x: number; readonly y: number }

export type MarqueeBox = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

type MarqueeFace = GridRect & { readonly index: number }

export type MarqueeDeck = { readonly current: number; readonly order: readonly string[] }

const dragSlop = 4
const edge = 56
const fastest = 24

export function marqueeBox(start: MarqueePoint, end: MarqueePoint): MarqueeBox {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  }
}

export function dragStarted(start: MarqueePoint, end: MarqueePoint): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= dragSlop
}

export function marqueeHits(box: MarqueeBox, faces: readonly MarqueeFace[]): readonly number[] {
  return faces
    .filter(
      (face) =>
        box.left <= face.left + face.width &&
        box.right >= face.left &&
        box.top <= face.top + face.height &&
        box.bottom >= face.top,
    )
    .map((face) => face.index)
    .sort((left, right) => left - right)
}

export function marqueeStep(
  before: GridInteraction,
  { current, order }: MarqueeDeck,
  hits: readonly number[],
  adding: boolean,
): GridStep {
  const kept = adding ? gridRinged(before, order, current) : []
  if (adding && hits.every((hit) => kept.includes(hit))) return { kind: "restore", state: before }
  const slides = new Set(order.filter((_, index) => kept.includes(index) || hits.includes(index)))
  const anchor = (adding ? prunedPick(gridPick(before), order)?.anchor : undefined) ?? [...slides][0]
  return anchor === undefined ? { kind: "clear" } : { kind: "pick", pick: { anchor, slides } }
}

function edgeSpeed(at: number, start: number, length: number): number {
  const fromStart = at - start
  const fromEnd = start + length - at
  if (fromStart < edge) return Math.ceil((fastest * (edge - fromStart)) / edge)
  if (fromEnd < edge) return -Math.ceil((fastest * (edge - fromEnd)) / edge)
  return 0
}

export function edgePan(point: MarqueePoint, room: GridRect): MarqueePoint {
  const outside =
    point.x < room.left || point.x > room.left + room.width || point.y < room.top || point.y > room.top + room.height
  if (outside) return { x: 0, y: 0 }
  return { x: edgeSpeed(point.x, room.left, room.width), y: edgeSpeed(point.y, room.top, room.height) }
}
