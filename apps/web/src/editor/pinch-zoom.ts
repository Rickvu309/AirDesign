import { wheelZoomFactor, type ScreenPoint } from "@/editor/canvas-viewport"

type SafariGestureEvent = Event & {
  readonly scale?: number
  readonly clientX?: number
  readonly clientY?: number
}

type PinchZoomOptions = {
  readonly onZoom: (factor: number, point: ScreenPoint) => void
  readonly onWheel?: (event: WheelEvent) => void
  readonly onEnd?: () => void
  readonly enabled?: () => boolean
  readonly fallbackPoint?: () => ScreenPoint | null
}

export type PinchZoomHandle = {
  readonly settled: () => void
  readonly cancel: () => void
  readonly dispose: () => void
}

function validScale(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function gestureZoomFactor(previous: number, next: number): number | null {
  const from = validScale(previous)
  const to = validScale(next)
  return from === null || to === null ? null : to / from
}

export function listenPinchZoom(element: HTMLElement, options: PinchZoomOptions): PinchZoomHandle {
  let source: "wheel" | "gesture" | null = null
  let scale: number | null = null
  let pointer: ScreenPoint | null = null

  function pointOf(event: SafariGestureEvent): ScreenPoint | null {
    if (finiteNumber(event.clientX) && finiteNumber(event.clientY)) {
      if (event.clientX !== 0 || event.clientY !== 0 || pointer === null) {
        return { x: event.clientX, y: event.clientY }
      }
      return pointer
    }
    return pointer ?? options.fallbackPoint?.() ?? null
  }

  function move(event: PointerEvent) {
    pointer = { x: event.clientX, y: event.clientY }
  }

  function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      if (options.enabled !== undefined && !options.enabled()) return
      if (source === "gesture") return
      source = "wheel"
      scale = null
      options.onZoom(wheelZoomFactor(event), { x: event.clientX, y: event.clientY })
      return
    }
    source = null
    scale = null
    options.onWheel?.(event)
  }

  function gestureStart(raw: Event) {
    const event = raw as SafariGestureEvent
    event.preventDefault()
    if (options.enabled !== undefined && !options.enabled()) return
    if (source === "wheel") return
    source = "gesture"
    scale = validScale(event.scale) ?? 1
  }

  function gestureChange(raw: Event) {
    const event = raw as SafariGestureEvent
    event.preventDefault()
    if (options.enabled !== undefined && !options.enabled()) return
    if (source === "wheel") return
    const next = validScale(event.scale)
    if (next === null) return
    const previous = scale ?? 1
    source = "gesture"
    scale = next
    const factor = gestureZoomFactor(previous, next)
    if (factor === null || factor === 1) return
    const point = pointOf(event)
    if (point === null) return
    options.onZoom(factor, point)
  }

  function gestureEnd(raw: Event) {
    const event = raw as SafariGestureEvent
    event.preventDefault()
    if (source === "wheel") return
    const active = source === "gesture" || scale !== null
    source = null
    scale = null
    if (active) options.onEnd?.()
  }

  function settled() {
    source = null
  }

  function cancel() {
    source = null
    scale = null
  }

  element.addEventListener("pointermove", move, { passive: true })
  element.addEventListener("wheel", wheel, { passive: false })
  element.addEventListener("gesturestart", gestureStart, { passive: false })
  element.addEventListener("gesturechange", gestureChange, { passive: false })
  element.addEventListener("gestureend", gestureEnd, { passive: false })

  return {
    settled,
    cancel,
    dispose() {
      cancel()
      element.removeEventListener("pointermove", move)
      element.removeEventListener("wheel", wheel)
      element.removeEventListener("gesturestart", gestureStart)
      element.removeEventListener("gesturechange", gestureChange)
      element.removeEventListener("gestureend", gestureEnd)
    },
  }
}
