import { useEffect, useRef } from "react"
import { leadOf, type CanvasSlide, type Selection } from "@airdesign/render"
import type { ElementId } from "@airdesign/document"
import {
  controlHandsKeysBack,
  handOf,
  leavesPicker,
  pickerHandsKeysBack,
  pickerOpen,
  type Hand,
} from "@/editor/editor-key-ownership"

export function canvasFrame(slide: CanvasSlide | null, node: ElementId): HTMLElement | null {
  const key = slide?.elements.find((each) => each.id === node)?.key
  if (key === undefined) return null
  return document.querySelector<HTMLElement>(`[data-slide-paint] [data-canvas-element="${CSS.escape(key)}"]`)
}

export function selectionFocus(slide: CanvasSlide | null, selection: Selection): HTMLElement | null {
  const lead = leadOf(selection)
  if (lead !== null) return canvasFrame(slide, lead)
  if (document.querySelector("[data-grid-viewport]") !== null) return null
  return document.querySelector<HTMLElement>("[data-slide-paint]")
}

export function useKeysBackToCanvas(working: boolean, canvasFocus: () => HTMLElement | null) {
  const latest = useRef(canvasFocus)
  useEffect(() => {
    latest.current = canvasFocus
  })
  useEffect(() => {
    if (!working) return
    let onCanvas: HTMLElement | null = null
    function handBack(from: Element) {
      queueMicrotask(() => {
        if (document.activeElement !== from || from.getAttribute("aria-invalid") === "true" || pickerOpen()) return
        const frame = latest.current()
        const kept = onCanvas !== null && frame?.contains(onCanvas) === true ? onCanvas : frame
        kept?.focus({ preventScroll: true })
      })
    }
    let hand: Hand = "pointer"
    let leftBy: Hand | null = null
    function keyed(event: KeyboardEvent) {
      hand = handOf(event, hand)
      leftBy = null
    }
    function committed(event: KeyboardEvent) {
      if (controlHandsKeysBack(event) && event.target instanceof Element) handBack(event.target)
    }
    function pointed(event: PointerEvent) {
      hand = handOf(event, hand)
      leftBy = null
    }
    function left(event: FocusEvent) {
      const { target } = event
      if (target instanceof HTMLElement && target.closest("[data-slide-paint]") !== null) onCanvas = target
      leftBy = leavesPicker(event) ? hand : null
    }
    function focused(event: FocusEvent) {
      if (pickerHandsKeysBack(event.target, leftBy) && event.target instanceof Element) handBack(event.target)
      leftBy = null
    }
    window.addEventListener("keydown", keyed, true)
    window.addEventListener("keydown", committed)
    window.addEventListener("pointerdown", pointed, true)
    window.addEventListener("focusout", left, true)
    window.addEventListener("focusin", focused, true)
    return () => {
      window.removeEventListener("keydown", keyed, true)
      window.removeEventListener("keydown", committed)
      window.removeEventListener("pointerdown", pointed, true)
      window.removeEventListener("focusout", left, true)
      window.removeEventListener("focusin", focused, true)
    }
  }, [working])
}
