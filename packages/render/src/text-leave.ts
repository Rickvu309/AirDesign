import type { ElementId } from "@airdesign/document"
import { useEffect, useRef, type RefObject } from "react"
import type { CanvasSlide } from "./record.js"

const keepsSelection = "[data-keeps-selection]"

export function leftText(event: FocusEvent, slide: CanvasSlide): ElementId | null {
  const body = event.target instanceof Element ? event.target.closest("[data-text-body]") : null
  const frame = body?.closest<HTMLElement>("[data-canvas-element]")
  if (body === null || body === undefined || frame === null || frame === undefined) return null
  const next = event.relatedTarget
  if (next instanceof Node && body.contains(next)) return null
  if (next instanceof Element && next.closest(keepsSelection) !== null) return null
  if (next === null && !body.ownerDocument.hasFocus()) return null
  return slide.elements.find((each) => each.key === frame.dataset.canvasElement)?.id ?? null
}

export function useTextLeave(
  surface: RefObject<HTMLElement | null>,
  slide: CanvasSlide,
  onLeave: ((id: ElementId) => void) | undefined,
): void {
  const latest = useRef({ slide, onLeave })
  latest.current = { slide, onLeave }
  const watching = onLeave !== undefined
  useEffect(() => {
    const host = surface.current
    if (host === null || !watching) return
    function left(event: FocusEvent) {
      const id = leftText(event, latest.current.slide)
      if (id !== null) latest.current.onLeave?.(id)
    }
    host.addEventListener("focusout", left)
    return () => host.removeEventListener("focusout", left)
  }, [surface, watching])
}
