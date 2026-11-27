import type * as doom from "@airdesign/doom"
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import type { CanvasGesture } from "./canvas-gesture"
import { unitOf } from "./selection"
import type { Placed, SlideGeometry } from "@/editing/slide-geometry"
import type { PointerArgs } from "./use-canvas-pointer"

export type HoverPoint = Pick<ReactPointerEvent, "clientX" | "clientY" | "metaKey" | "ctrlKey">

export function useCanvasHover({
  latest,
  active,
  panning,
  chainAt,
}: {
  readonly latest: RefObject<PointerArgs>
  readonly active: RefObject<CanvasGesture | null>
  readonly panning: boolean
  readonly chainAt: (point: HoverPoint, geometry: SlideGeometry, view: doom.Doom) => readonly Placed[] | null
}) {
  const point = useRef<HoverPoint | null>(null)

  function update(at: HoverPoint) {
    const a = latest.current
    const chain = chainAt(at, a.geometry, a.view)
    a.setHover(chain === null ? null : unitOf(chain, a.selection.inside, at.metaKey || at.ctrlKey).id)
  }

  function restore() {
    const a = latest.current
    const at = point.current
    if (at === null || a.texting || active.current !== null) return
    if (a.stage.current?.contains(document.elementFromPoint(at.clientX, at.clientY))) update(at)
  }

  useEffect(() => {
    if (panning) latest.current.setHover(null)
    else restore()
  }, [panning])

  return { point, update, restore }
}
