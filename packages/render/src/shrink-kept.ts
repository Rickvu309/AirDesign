import type { ElementId } from "@airdesign/document"
import { useLayoutEffect } from "react"
import type { CanvasElement } from "./record.js"
import type { FitPainter, PaintStore } from "./store.js"

export function useShrinkKept(
  store: PaintStore,
  id: ElementId,
  element: CanvasElement,
  written: string,
  painter: FitPainter,
) {
  const fit = element.text?.fit
  const scale = fit?.kind === "shrink" ? fit.scale : null
  const reduction = fit?.kind === "shrink" ? fit.reduction : null
  useLayoutEffect(() => {
    if (scale === null || reduction === null || written === "") return
    store.placeFit(id, { written, scale, reduction }, painter)
  }, [store, id, written, scale, reduction, painter])
}
