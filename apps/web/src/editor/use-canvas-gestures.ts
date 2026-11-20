import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { flushSync } from "react-dom"
import { gestureFor } from "@airdesign/render"

import { editorOwnsKey } from "@/editor/editor-key-ownership"
import {
  boundedFactor,
  centredAt,
  placedScroll,
  selectionFactor,
  unionRect,
  viewCentre,
  wheelPixelsOf,
  zoomedAbout,
  type ScreenPoint,
  type ScreenRect,
  type WidthLimits,
} from "@/editor/canvas-viewport"
import { listenPinchZoom, type PinchZoomHandle } from "@/editor/pinch-zoom"

export type CanvasView = {
  readonly aim: (width: number, commit: () => void) => void
  readonly selection: (commit: (width: number) => void) => boolean
}

type Gesture = { readonly laid: ScreenRect; readonly origin: ScreenPoint; wanted: ScreenRect }

const settleAfter = 150

const unbounded: WidthLimits = { least: 1, most: Number.POSITIVE_INFINITY }

const selectionFrames = "[data-slide-wrapper] [data-selection], [data-slide-wrapper] [data-selection-around]"

const pressable =
  "button, a[href], [role=button], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=tab], [role=switch], [role=checkbox], [role=option], [role=dialog], [role=alertdialog]"

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null)
  )
}

function spacePans(target: EventTarget | null): boolean {
  if (typing(target)) return false
  if (target instanceof Element && target.closest(pressable) !== null) return false
  return document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') === null
}

function rectOf(element: Element): ScreenRect {
  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}

export function useCanvasGestures({
  root,
  stage,
  content,
  overlay,
  pans,
  limits = unbounded,
  onZoom,
  view,
}: {
  root: RefObject<HTMLDivElement | null>
  stage: RefObject<HTMLDivElement | null>
  content: RefObject<HTMLDivElement | null>
  overlay: number
  pans: boolean
  limits?: WidthLimits | undefined
  onZoom?: ((width: number) => void) | undefined
  view?: RefObject<CanvasView | null> | undefined
}) {
  const [space, setSpace] = useState(false)
  const [panning, setPanning] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const pinch = useRef<PinchZoomHandle | null>(null)
  const placing = useRef(false)
  const frame = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ overlay, limits, onZoom })
  latest.current = { overlay, limits, onZoom }

  function slideRect(): ScreenRect | null {
    const wrapper = content.current?.querySelector("[data-slide-wrapper]")
    return wrapper === null || wrapper === undefined ? null : rectOf(wrapper)
  }

  function viewRect(): ScreenRect | null {
    const element = stage.current
    if (element === null) return null
    const box = rectOf(element)
    return { ...box, height: Math.max(0, box.height - latest.current.overlay) }
  }

  function place(wanted: ScreenRect, commit: () => void) {
    placing.current = true
    try {
      flushSync(commit)
    } finally {
      placing.current = false
    }
    const laid = slideRect()
    const element = stage.current
    if (laid === null || element === null) return
    const next = placedScroll({ left: element.scrollLeft, top: element.scrollTop }, laid, wanted)
    element.scrollLeft = next.left
    element.scrollTop = next.top
  }

  function paint() {
    frame.current = null
    const held = gesture.current
    const element = content.current
    if (held === null || element === null) return
    const scale = held.wanted.width / held.laid.width
    const x = held.wanted.left - held.origin.x - scale * (held.laid.left - held.origin.x)
    const y = held.wanted.top - held.origin.y - scale * (held.laid.top - held.origin.y)
    element.style.transformOrigin = "0 0"
    element.style.willChange = "transform"
    element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }

  function settle() {
    pinch.current?.settled()
    if (timer.current !== null) clearTimeout(timer.current)
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    timer.current = null
    frame.current = null
    const held = gesture.current
    gesture.current = null
    const element = content.current
    if (held === null) return
    if (element !== null) {
      element.style.transform = ""
      element.style.willChange = ""
      element.style.transformOrigin = ""
    }
    place(held.wanted, () => latest.current.onZoom?.(held.wanted.width))
  }

  function zoomBy(factor: number, point: ScreenPoint) {
    let held = gesture.current
    if (held === null) {
      const laid = slideRect()
      const element = content.current
      if (laid === null || element === null || laid.width <= 0) return
      const origin = rectOf(element)
      held = { laid, origin: { x: origin.left, y: origin.top }, wanted: laid }
      gesture.current = held
    }
    const bounded = boundedFactor(held.wanted.width, factor, latest.current.limits)
    held.wanted = zoomedAbout(held.wanted, bounded, point)
    if (frame.current === null) frame.current = requestAnimationFrame(paint)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(settle, settleAfter)
  }

  useLayoutEffect(() => {
    const element = root.current
    if (element === null) return
    const handle = listenPinchZoom(element, {
      enabled: () => latest.current.onZoom !== undefined,
      onZoom: zoomBy,
      onEnd: settle,
      onWheel(event) {
        settle()
        const scroller = stage.current
        if (scroller === null || !(event.target instanceof Element) || event.target.closest("[data-hand-pan]") === null)
          return
        const { x, y } = wheelPixelsOf(event)
        scroller.scrollBy(event.shiftKey && x === 0 ? { left: y, top: 0 } : { left: x, top: y })
      },
      fallbackPoint() {
        const shown = viewRect()
        return shown === null ? null : viewCentre(shown)
      },
    })
    pinch.current = handle
    function stop() {
      handle.cancel()
      settle()
    }
    element.addEventListener("pointerdown", stop, true)
    window.addEventListener("blur", stop)
    return () => {
      pinch.current = null
      handle.dispose()
      element.removeEventListener("pointerdown", stop, true)
      window.removeEventListener("blur", stop)
      settle()
    }
  }, [])

  useEffect(() => {
    if (!pans) return
    function down(event: KeyboardEvent) {
      if (event.isComposing || gestureFor(event, "editor") !== "pan" || !spacePans(event.target)) return
      if (!editorOwnsKey(event)) return
      event.preventDefault()
      if (!event.repeat) setSpace(true)
    }
    function up(event: KeyboardEvent) {
      if (event.code === "Space") setSpace(false)
    }
    function release() {
      setSpace(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", release)
    return () => {
      release()
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", release)
    }
  }, [pans])

  useLayoutEffect(() => {
    if (view === undefined) return
    view.current = {
      aim(width, commit) {
        settle()
        const laid = slideRect()
        const shown = viewRect()
        if (laid === null || shown === null || laid.width <= 0) {
          flushSync(commit)
          return
        }
        place(zoomedAbout(laid, width / laid.width, viewCentre(shown)), commit)
      },
      selection(commit) {
        settle()
        const frames = [...(root.current?.querySelectorAll(selectionFrames) ?? [])].map(rectOf)
        const selected = unionRect(frames.filter((rect) => rect.width > 0 || rect.height > 0))
        const laid = slideRect()
        const shown = viewRect()
        if (selected === null || laid === null || shown === null || laid.width <= 0) return false
        const factor = boundedFactor(laid.width, selectionFactor(selected, shown), latest.current.limits)
        place(centredAt(laid, selected, factor, viewCentre(shown)), () => commit(laid.width * factor))
        return true
      },
    }
    return () => {
      view.current = null
    }
  })

  return { space, panning, setPanning, placing: () => placing.current }
}
