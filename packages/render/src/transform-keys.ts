import type { ElementId } from "@airdesign/document"
import type { KeyboardEvent } from "react"
import type { GestureId } from "./gestures.js"
import type { CanvasSlide } from "./record.js"
import type { PaintStore } from "./store.js"
import { flipsBy, type TransformActions, type Turned } from "./transform-drag.js"
import { normalizeDegrees, selectionFrame, type RotatedLayer } from "./transform-math.js"

export function turnedLayers(layers: ReadonlyMap<ElementId, RotatedLayer>, delta: number): readonly Turned[] {
  const frame = selectionFrame(layers)
  if (frame === null) return []
  const middle = { x: frame.x + frame.cx / 2, y: frame.y + frame.cy / 2 }
  const radians = (delta * Math.PI) / 180
  return [...layers].map(([id, { box, rotation }]): Turned => {
    const turnedRotation = normalizeDegrees(Math.round((rotation + delta) * 10) / 10)
    if (layers.size === 1) return { id, rotation: turnedRotation }
    const along = { x: box.x + box.cx / 2 - middle.x, y: box.y + box.cy / 2 - middle.y }
    const x = middle.x + along.x * Math.cos(radians) - along.y * Math.sin(radians)
    const y = middle.y + along.x * Math.sin(radians) + along.y * Math.cos(radians)
    return {
      id,
      rotation: turnedRotation,
      box: { ...box, x: Math.round(x - box.cx / 2), y: Math.round(y - box.cy / 2) },
    }
  })
}

export function transformByKey(
  event: KeyboardEvent<HTMLElement>,
  gesture: "flip-horizontal" | "flip-vertical",
  layers: { readonly slide: CanvasSlide; readonly store: PaintStore; readonly ids: readonly ElementId[] },
  transforms: TransformActions | undefined,
) {
  const { slide, store, ids } = layers
  const flips = flipsBy(slide, store, ids, gesture)
  if (flips.length === 0 || transforms?.onFlip === undefined) return
  event.preventDefault()
  transforms.onFlip(flips)
}

export function transformsByKey(gesture: GestureId | null): gesture is "flip-horizontal" | "flip-vertical" {
  return gesture === "flip-horizontal" || gesture === "flip-vertical"
}
