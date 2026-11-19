import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import { followed, ownBox, type Point } from "./box-gesture.js"
import type { CanvasElement, CanvasSlide, PaintBox } from "./record.js"
import { alone, leadOf, noSelection, type Selection } from "./selection.js"
import { marqueeHits, marqueeMoved, marqueeRect, marqueeSelection } from "./slide-marquee.js"
import type { PaintStore } from "./store.js"

const overlayMenu =
  '[role="menu"][data-open], [data-slot="popover-content"][data-open], [role="dialog"][data-open], [role="alertdialog"][data-open], [data-hand-pan]'
const stageBlocked =
  "[data-slide-paint], [data-slide-label], [data-keeps-selection], button, a[href], input, textarea, select"

export type OwnsKey = (event: KeyboardEvent | ReactKeyboardEvent) => boolean

type HeldMarquee = {
  readonly pointer: number
  readonly from: Point
  readonly startLocal: Point
  readonly lastClient: Point
  readonly adding: boolean
  deep: boolean
  readonly before: Selection
  readonly fallback: CanvasElement | undefined
  active: boolean
  cancelled: boolean
}

export function liveBoxOf(element: CanvasElement, store: PaintStore): PaintBox | null {
  if (element.id === null) return element.box
  const group = element.group
  const carried = group === undefined ? null : store.getBox(group.id)
  const own = ownBox(element, store.getBox(element.id))
  return group === undefined ? own : followed(own, group.box, carried, group.frame === undefined)
}

export function hasOpenOverlay(doc: Document): boolean {
  return doc.querySelector(overlayMenu) !== null
}

function localPoint(surface: HTMLElement, width: number, client: Point): Point {
  const rect = surface.getBoundingClientRect()
  const scale = rect.width > 0 && width > 0 ? rect.width / width : 1
  return { x: (client.x - rect.left) / scale, y: (client.y - rect.top) / scale }
}

function emuPoint(local: Point, width: number, slide: CanvasSlide): Point {
  const ratio = width > 0 ? slide.width / width : 0
  return { x: local.x * ratio, y: local.y * ratio }
}

function onScrollbar(stage: HTMLElement, client: Point): boolean {
  const rect = stage.getBoundingClientRect()
  if (stage.clientWidth > 0 && client.x >= rect.left + stage.clientWidth) return true
  if (stage.clientHeight > 0 && client.y >= rect.top + stage.clientHeight) return true
  return false
}

function swallowNextClick(win: Window) {
  function stop(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
  }
  win.addEventListener("click", stop, { capture: true, once: true })
  win.setTimeout(() => win.removeEventListener("click", stop, { capture: true }), 0)
}

function focusSelection(surface: HTMLElement, slide: CanvasSlide, selection: Selection) {
  const lead = leadOf(selection)
  const element = lead === null ? undefined : slide.elements.find((each) => each.id === lead)
  const frame =
    element === undefined ? null : surface.querySelector<HTMLElement>(`[data-canvas-element="${element.key}"]`)
  if (frame !== null) frame.focus({ preventScroll: true })
  else surface.focus({ preventScroll: true })
}

export function useSlideMarquee(params: {
  readonly surface: RefObject<HTMLDivElement | null>
  readonly enabled: boolean
  readonly slide: CanvasSlide
  readonly width: number
  readonly store: PaintStore
  readonly selection: RefObject<Selection>
  readonly choose: (next: Selection) => void
  readonly isDragging: () => boolean
  readonly ownsKey?: OwnsKey | undefined
  readonly onActiveChange?: (active: boolean) => void
}) {
  const mark = useRef<HTMLDivElement>(null)
  const held = useRef<HeldMarquee | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  const latest = useRef(params)
  latest.current = params

  function hideMark() {
    const box = mark.current
    if (box !== null) box.hidden = true
  }

  function paint(current: HeldMarquee, client: Point) {
    const { surface, width, slide, store, choose } = latest.current
    const host = surface.current
    const box = mark.current
    if (host === null || box === null) return
    const endLocal = localPoint(host, width, client)
    const visual = marqueeRect(current.startLocal, endLocal)
    box.hidden = false
    box.style.transform = `translate(${visual.left}px, ${visual.top}px)`
    box.style.width = `${visual.right - visual.left}px`
    box.style.height = `${visual.bottom - visual.top}px`
    const emu = marqueeRect(emuPoint(current.startLocal, width, slide), emuPoint(endLocal, width, slide))
    const hits = marqueeHits(slide, emu, {
      deep: current.deep,
      resolveBox: (element) => liveBoxOf(element, store),
    })
    choose(marqueeSelection(slide, current.before, hits, current.adding))
  }

  function finishListening() {
    cleanup.current?.()
    cleanup.current = null
  }

  function startPointer(
    event: {
      readonly button: number
      readonly pointerId: number
      readonly pointerType: string
      readonly clientX: number
      readonly clientY: number
      readonly shiftKey: boolean
      readonly metaKey: boolean
      readonly ctrlKey: boolean
      preventDefault(): void
    },
    fallback?: CanvasElement,
  ) {
    const { enabled, surface, width, selection, choose, isDragging } = latest.current
    const host = surface.current
    if (!enabled || host === null || event.button !== 0 || event.pointerType === "touch") return
    if (held.current !== null || isDragging() || hasOpenOverlay(host.ownerDocument)) return
    event.preventDefault()
    const doc = host.ownerDocument
    const win = doc.defaultView ?? window
    const from = { x: event.clientX, y: event.clientY }
    const adding = event.shiftKey
    const before = selection.current
    if (!adding && fallback === undefined) {
      choose(noSelection)
      host.focus({ preventScroll: true })
    }
    const state: HeldMarquee = {
      pointer: event.pointerId,
      from,
      startLocal: localPoint(host, width, from),
      lastClient: from,
      adding,
      deep: event.metaKey || event.ctrlKey,
      before,
      fallback,
      active: false,
      cancelled: false,
    }
    held.current = state

    function move(moveEvent: PointerEvent) {
      const now = held.current
      if (now === null || now.pointer !== moveEvent.pointerId || now.cancelled) return
      const client = { x: moveEvent.clientX, y: moveEvent.clientY }
      if (!now.active && !marqueeMoved(now.from, client)) return
      if (!now.active) {
        now.active = true
        latest.current.onActiveChange?.(true)
        doc.getSelection()?.removeAllRanges()
      }
      if (moveEvent.metaKey || moveEvent.ctrlKey) now.deep = true
      held.current = { ...now, lastClient: client }
      paint(held.current, client)
    }

    function cancel() {
      const now = held.current
      if (now === null || now.cancelled) return
      now.cancelled = true
      hideMark()
      if (now.active) {
        latest.current.onActiveChange?.(false)
        latest.current.choose(now.before)
      }
    }

    function onKeyDown(keyEvent: KeyboardEvent) {
      const now = held.current
      if (now === null || !now.active || now.cancelled) return
      if (keyEvent.key === "Escape") {
        if (latest.current.ownsKey !== undefined && !latest.current.ownsKey(keyEvent)) return
        keyEvent.preventDefault()
        keyEvent.stopPropagation()
        cancel()
        return
      }
      if ((keyEvent.key === "Meta" || keyEvent.key === "Control") && !now.deep) {
        now.deep = true
        paint(now, now.lastClient)
      }
    }

    function onKeyUp(keyEvent: KeyboardEvent) {
      const now = held.current
      if (now === null || !now.active || now.cancelled) return
      if (keyEvent.key === "Meta" || keyEvent.key === "Control") {
        const nextDeep = keyEvent.metaKey || keyEvent.ctrlKey
        if (nextDeep !== now.deep) {
          now.deep = nextDeep
          paint(now, now.lastClient)
        }
      }
    }

    function release(upEvent: PointerEvent) {
      const now = held.current
      if (now === null || now.pointer !== upEvent.pointerId) return
      held.current = null
      finishListening()
      hideMark()
      if (now.active) {
        latest.current.onActiveChange?.(false)
        swallowNextClick(win)
        if (!now.cancelled) {
          const currentHost = latest.current.surface.current
          if (currentHost !== null) focusSelection(currentHost, latest.current.slide, latest.current.selection.current)
        }
        return
      }
      if (!now.cancelled && now.fallback?.id != null) {
        const next = alone(latest.current.slide, now.fallback.id)
        latest.current.choose(next)
        const currentHost = latest.current.surface.current
        if (currentHost !== null) focusSelection(currentHost, latest.current.slide, next)
      }
    }

    function lost(cancelEvent: PointerEvent) {
      if (held.current?.pointer === cancelEvent.pointerId) {
        cancel()
        held.current = null
        finishListening()
      }
    }

    function blurred() {
      cancel()
      held.current = null
      finishListening()
    }

    doc.addEventListener("pointermove", move)
    doc.addEventListener("pointerup", release)
    doc.addEventListener("pointercancel", lost)
    win.addEventListener("keydown", onKeyDown, true)
    win.addEventListener("keyup", onKeyUp, true)
    win.addEventListener("blur", blurred)
    cleanup.current = () => {
      doc.removeEventListener("pointermove", move)
      doc.removeEventListener("pointerup", release)
      doc.removeEventListener("pointercancel", lost)
      win.removeEventListener("keydown", onKeyDown, true)
      win.removeEventListener("keyup", onKeyUp, true)
      win.removeEventListener("blur", blurred)
    }
  }

  useEffect(() => {
    const host = params.surface.current
    if (!params.enabled || host === null) return
    const stage = host.closest<HTMLElement>("[data-canvas-stage]")
    if (stage === null) return
    function onStageDown(event: PointerEvent) {
      if (!(event.target instanceof Element)) return
      if (event.target.closest(stageBlocked) !== null) return
      if (stage !== null && onScrollbar(stage, { x: event.clientX, y: event.clientY })) return
      startPointer(event)
    }
    stage.addEventListener("pointerdown", onStageDown)
    return () => stage.removeEventListener("pointerdown", onStageDown)
  }, [params.enabled, params.surface])

  useEffect(
    () => () => {
      finishListening()
      held.current = null
      hideMark()
    },
    [],
  )

  return {
    mark,
    start: (event: ReactPointerEvent<HTMLElement>, fallback?: CanvasElement) => startPointer(event, fallback),
    isActive: () => held.current?.active === true,
  }
}
