import type { ElementId } from "@airdesign/document"
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react"
import type { CanvasSlide } from "./record.js"
import { hoverTarget, type Selection } from "./selection.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"
import { liveBox } from "./live-box.js"
import { hasOpenOverlay } from "./use-slide-marquee.js"

function elementIdFromTarget(target: EventTarget | null, slide: CanvasSlide): ElementId | null {
  if (!(target instanceof Element)) return null
  const key = target.closest("[data-canvas-element]")?.getAttribute("data-canvas-element")
  if (key === null || key === undefined) return null
  return slide.elements.find((each) => each.key === key)?.id ?? null
}

export function useHoverOutline(params: {
  readonly surface: RefObject<HTMLDivElement | null>
  readonly enabled: boolean
  readonly slide: CanvasSlide
  readonly width: number
  readonly scaled: Scaled
  readonly store: PaintStore
  readonly selection: Selection
  readonly isBusy: () => boolean
}) {
  const mark = useRef<HTMLDivElement>(null)
  const hovered = useRef<{ id: ElementId | null; deep: boolean }>({ id: null, deep: false })
  const latest = useRef(params)
  latest.current = params

  function hide() {
    const box = mark.current
    if (box === null) return
    box.hidden = true
    box.dataset.hoverOutline = ""
  }

  function paint() {
    const { surface, enabled, slide, scaled, store, selection, isBusy } = latest.current
    const host = surface.current
    const box = mark.current
    if (!enabled || host === null || box === null || isBusy() || hasOpenOverlay(host.ownerDocument)) {
      hide()
      return
    }
    const target = hoverTarget(slide, selection, hovered.current.id, hovered.current.deep)
    if (target === null) {
      hide()
      return
    }
    const element = slide.elements.find((each) => each.id === target)
    const placed = element === undefined ? null : liveBox(store, element)
    if (placed === null) {
      hide()
      return
    }
    box.hidden = false
    box.dataset.hoverOutline = target
    box.style.left = `${scaled(placed.x)}px`
    box.style.top = `${scaled(placed.y)}px`
    box.style.width = `${scaled(placed.width)}px`
    box.style.height = `${scaled(placed.height)}px`
    box.style.transform = placed.rotation === 0 ? "" : `rotate(${placed.rotation}deg)`
  }

  useLayoutEffect(paint, [params.enabled, params.slide, params.width, params.selection])

  useEffect(() => {
    const host = params.surface.current
    if (!params.enabled || host === null) return
    const win = host.ownerDocument.defaultView ?? window
    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") {
        hovered.current = { id: null, deep: false }
        hide()
        return
      }
      const id = elementIdFromTarget(event.target, latest.current.slide)
      const deep = event.metaKey || event.ctrlKey
      if (hovered.current.id === id && hovered.current.deep === deep) {
        if (id !== null && mark.current?.hidden === true) paint()
        return
      }
      hovered.current = { id, deep }
      paint()
    }
    function onPointerLeave() {
      hovered.current = { id: null, deep: false }
      hide()
    }
    function onModifier(event: KeyboardEvent) {
      if (event.key !== "Meta" && event.key !== "Control") return
      const deep = event.metaKey || event.ctrlKey
      if (hovered.current.id === null || hovered.current.deep === deep) return
      hovered.current = { ...hovered.current, deep }
      paint()
    }
    host.addEventListener("pointermove", onPointerMove)
    host.addEventListener("pointerleave", onPointerLeave)
    win.addEventListener("keydown", onModifier)
    win.addEventListener("keyup", onModifier)
    return () => {
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerleave", onPointerLeave)
      win.removeEventListener("keydown", onModifier)
      win.removeEventListener("keyup", onModifier)
    }
  }, [params.enabled, params.surface])

  return { mark, hide }
}
