import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import type { CanvasSlide } from "./record.js"

export function useSlideFocusKept(
  surface: RefObject<HTMLElement | null>,
  slide: CanvasSlide,
  watching: boolean,
  chosen: number,
): void {
  const held = useRef(false)
  const dropped = useRef<Node | null>(null)
  useEffect(() => {
    const host = surface.current
    if (host === null || !watching) return
    function came() {
      held.current = true
      dropped.current = null
    }
    function went(event: FocusEvent) {
      const next = event.relatedTarget
      if (next instanceof Node && host?.contains(next)) return
      held.current = false
      dropped.current = next === null && event.target instanceof Node ? event.target : null
    }
    host.addEventListener("focusin", came)
    host.addEventListener("focusout", went)
    return () => {
      host.removeEventListener("focusin", came)
      host.removeEventListener("focusout", went)
    }
  }, [surface, watching])
  useLayoutEffect(() => {
    const host = surface.current
    const gone = dropped.current
    dropped.current = null
    if (host === null || chosen > 0 || !(held.current || (gone !== null && !gone.isConnected))) return
    const active = host.ownerDocument.activeElement
    if (active === null || active === host.ownerDocument.body) host.focus({ preventScroll: true })
  }, [surface, slide, chosen])
}
