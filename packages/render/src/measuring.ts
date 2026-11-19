import type { ElementId } from "@airdesign/document"
import { useEffect, type RefObject } from "react"
import { measured } from "./distances.js"
import { paintedBounds } from "./drag-snap.js"
import type { GuideBoard } from "./guide-layer.js"
import type { CanvasSlide } from "./record.js"
import { around, type Bounds } from "./snapping.js"
import type { PaintStore } from "./store.js"

const painted = "[data-canvas-element]"

export function useMeasuring(
  surface: RefObject<HTMLDivElement | null>,
  slide: CanvasSlide,
  store: PaintStore,
  ids: readonly ElementId[] | undefined,
  board: GuideBoard | undefined,
): void {
  useEffect(() => {
    const host = surface.current
    if (host === null || board === undefined || ids === undefined || ids.length === 0) return
    const page = host.ownerDocument
    let held = false
    let pressed = false
    let showing = false
    let under: Element | null = null
    const chosen = slide.elements.filter((each) => each.id !== null && ids.includes(each.id))
    function targetOf(): Bounds {
      const key = under?.closest(painted)?.getAttribute("data-canvas-element")
      const element = slide.elements.find((each) => each.key === key)
      const bounds = element === undefined || chosen.includes(element) ? null : paintedBounds(element, store)
      return bounds ?? { left: 0, top: 0, right: slide.width, bottom: slide.height }
    }
    function show() {
      if (pressed) return
      const selected = held ? around(chosen.flatMap((each) => paintedBounds(each, store) ?? [])) : null
      if (selected !== null) {
        board?.show(measured(selected, targetOf()))
        showing = true
      } else if (showing) {
        board?.show([])
        showing = false
      }
    }
    function moved(event: PointerEvent) {
      if (event.buttons !== 0) return
      under = event.target instanceof Element ? event.target : null
      held = event.altKey
      show()
    }
    function left() {
      under = null
      show()
    }
    function keyed(event: KeyboardEvent) {
      if (event.key !== "Alt") return
      held = event.type === "keydown"
      show()
    }
    function down() {
      if (showing) board?.show([])
      showing = false
      pressed = true
    }
    function up() {
      pressed = false
    }
    function blurred() {
      held = false
      show()
    }
    const view = page.defaultView
    host.addEventListener("pointermove", moved)
    host.addEventListener("pointerleave", left)
    host.addEventListener("pointerdown", down)
    page.addEventListener("pointerup", up)
    page.addEventListener("pointercancel", up)
    page.addEventListener("keydown", keyed)
    page.addEventListener("keyup", keyed)
    view?.addEventListener("blur", blurred)
    return () => {
      host.removeEventListener("pointermove", moved)
      host.removeEventListener("pointerleave", left)
      host.removeEventListener("pointerdown", down)
      page.removeEventListener("pointerup", up)
      page.removeEventListener("pointercancel", up)
      page.removeEventListener("keydown", keyed)
      page.removeEventListener("keyup", keyed)
      view?.removeEventListener("blur", blurred)
      if (showing) board.show([])
    }
  }, [surface, slide, store, ids, board])
}
