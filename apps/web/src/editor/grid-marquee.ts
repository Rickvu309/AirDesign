import type { SlideId } from "@airdesign/document"
import { dragSlop } from "@/editor/grid-drop"
import { gridPick, gridRinged, type GridInteraction, type GridStep } from "@/editor/grid-interaction"
import { prunedPick } from "@/editor/grid-selection"

type MarqueePoint = { readonly x: number; readonly y: number }

export type MarqueeBox = {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

type MarqueeFace = {
  readonly index: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export function marqueeBox(start: MarqueePoint, end: MarqueePoint): MarqueeBox {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    right: Math.max(start.x, end.x),
    bottom: Math.max(start.y, end.y),
  }
}

export function marqueeStarted(start: MarqueePoint, end: MarqueePoint): boolean {
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

export type MarqueeDeck = { readonly current: number; readonly count: number; readonly ids?: readonly SlideId[] }

export function marqueeStep(
  before: GridInteraction,
  { current, count, ids }: MarqueeDeck,
  hits: readonly number[],
  adding: boolean,
): GridStep {
  const kept = adding ? gridRinged(before, current, count, ids) : []
  if (adding && hits.every((hit) => kept.includes(hit))) return { kind: "restore", state: before }
  const slides = new Set([...kept, ...hits])
  if (slides.size === 0) return { kind: "clear" }
  const anchor = (adding ? prunedPick(gridPick(before), count, ids)?.anchor : undefined) ?? Math.min(...slides)
  return { kind: "pick", pick: { anchor, slides } }
}
