import type { PaintBox } from "@airdesign/render"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import {
  createElement,
  memo,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"
import {
  zoomedGrid,
  pannedGrid,
  wheeledGrid,
  arrowGrid,
  fittedGridCards,
  fittedGridElements,
  fittedGridRows,
  resizedGrid,
  type GridGeometry,
  revealedGrid,
  gridScaleMoved,
  type GridViewport,
} from "@/editor/grid-viewport"
import { keptGridViewport, keepGridViewport } from "@/editor/grid-zoom"

const settleAfter = 180

const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])

function typing(target: Element): boolean {
  return (
    target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select") !== null)
  )
}

function canvasKeyTarget(target: EventTarget | null, host: HTMLElement | null): boolean {
  return (
    target === document.body ||
    (target !== null && (target === host || target === host?.querySelector("[data-focus-edge]")))
  )
}

function spacePans(target: EventTarget | null, host: HTMLElement | null): boolean {
  if (canvasKeyTarget(target, host)) return true
  if (!(target instanceof Element) || host === null || !host.contains(target) || typing(target)) return false
  return (
    target.closest("[data-slide-entry], [data-row-handle]") !== null ||
    target.closest("button, a[href], [role=button]") === null
  )
}

export function useGridViewport({
  deck,
  world,
  scale,
  hand,
  working,
  onZoom,
  initialFit,
  layout,
  fitting,
  onFit,
  selected,
  geometry,
}: {
  deck: string | null
  world: RefObject<HTMLDivElement | null>
  scale: number
  hand: boolean
  working: boolean
  onZoom: (size: number, persist?: boolean) => void
  onFit: (percent: number) => void
  layout: string
  fitting: boolean
  initialFit: boolean
  selected: number
  geometry: GridGeometry
}) {
  const focused = useRef(selected)
  const previous = useRef(selected)
  if (previous.current !== selected) focused.current = selected
  previous.current = selected
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const frame = useRef<number | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [restored] = useState(() => keptGridViewport(deck))
  const view = useRef<GridViewport>(restored ?? { x: 48, y: 24, scale })
  const kept = useRef(deck)
  kept.current = deck
  const [space, setSpace] = useState(false)
  const heldSpace = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const dragged = useRef(false)
  const pan = useRef<{ pointer: number; x: number; y: number; view: GridViewport } | null>(null)
  const first = useRef(initialFit && restored === null)
  const fits = useRef(fitting)
  fits.current = fitting
  const fitted = useRef(onFit)
  fitted.current = onFit
  const zoom = useRef(onZoom)
  zoom.current = onZoom

  function stopTimer() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  function store() {
    stopTimer()
    if (!dirty.current) return
    dirty.current = false
    keepGridViewport(kept.current, view.current)
    zoom.current(view.current.scale * 100, false)
  }

  function settle() {
    dirty.current = true
    fits.current = false
    stopTimer()
    timer.current = setTimeout(store, settleAfter)
  }

  useLayoutEffect(() => {
    window.addEventListener("pagehide", store)
    return () => {
      window.removeEventListener("pagehide", store)
      store()
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!working) return
    function release() {
      heldSpace.current = false
      setSpace(false)
    }
    function down(event: KeyboardEvent) {
      if (!editorOwnsKey(event)) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.code === "Space") {
        if (!spacePans(event.target, viewport.current)) return
        event.preventDefault()
        event.stopPropagation()
        heldSpace.current = true
        setSpace(true)
        return
      }
      if (event.shiftKey || !arrowKeys.has(event.key) || !canvasKeyTarget(event.target, viewport.current)) return
      event.preventDefault()
      paint(arrowGrid(view.current, event.key))
      settle()
    }
    function up(event: KeyboardEvent) {
      if (event.code === "Space") release()
    }
    window.addEventListener("keydown", down, true)
    window.addEventListener("keyup", up, true)
    window.addEventListener("blur", release)
    return () => {
      release()
      window.removeEventListener("keydown", down, true)
      window.removeEventListener("keyup", up, true)
      window.removeEventListener("blur", release)
    }
  }, [working])

  function paint(next: GridViewport) {
    view.current = next
    if (world.current !== null)
      world.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`
  }

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    if (first.current) {
      first.current = false
      paint(view.current)
      fit()
      return
    }
    if (!gridScaleMoved(view.current, scale)) {
      paint(view.current)
      return
    }
    paint(zoomedGrid(view.current, scale, { x: host.clientWidth / 2, y: host.clientHeight / 2 }))
    const card = world.current?.querySelector(`[data-slide-entry="${selected + 1}"]`)
    if (card) reveal(card)
    settle()
  }, [scale])

  useLayoutEffect(() => {
    if (fits.current) fit()
  }, [layout])

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = host.getBoundingClientRect()
      paint(wheeledGrid(view.current, event, { x: event.clientX - box.left, y: event.clientY - box.top }))
      settle()
      if (frame.current === null)
        frame.current = requestAnimationFrame(() => {
          frame.current = null
          flushSync(() => zoom.current(view.current.scale * 100, false))
        })
    }
    host.addEventListener("wheel", wheel, { passive: false })
    return () => host.removeEventListener("wheel", wheel)
  }, [])

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    let before = host.getBoundingClientRect()
    const observer = new ResizeObserver(() => {
      const after = host.getBoundingClientRect()
      if (fits.current) flushSync(() => fit())
      else {
        const card = world.current?.querySelector(`[data-slide-entry="${focused.current + 1}"]`)
        if (card) {
          const next = resizedGrid(view.current, card.getBoundingClientRect(), before, after)
          if (next !== view.current) {
            paint(next)
            settle()
          }
        }
      }
      before = after
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  function press(event: PointerEvent<HTMLDivElement>) {
    const target = event.target
    const blank =
      target instanceof Element &&
      target.closest("[data-grid-card], [data-section-head], [data-add-row], [data-row-handle]") === null
    if (event.button !== 1 && !(event.button === 0 && (hand || heldSpace.current || blank))) return
    dragged.current = hand || heldSpace.current || event.button === 1
    if (blank) event.currentTarget.focus({ preventScroll: true })
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.panning = "true"
    pan.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, view: view.current }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const held = pan.current
    if (held === null || held.pointer !== event.pointerId) return
    dragged.current = true
    paint(pannedGrid(held.view, { x: event.clientX - held.x, y: event.clientY - held.y }))
    settle()
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer === event.pointerId) {
      pan.current = null
      delete event.currentTarget.dataset.panning
    }
  }

  function reveal(target: Element) {
    const host = viewport.current
    const card = target.closest("[data-grid-card], [data-row-handle]")
    if (host === null || card === null) return
    host.scrollLeft = 0
    host.scrollTop = 0
    const box = card.getBoundingClientRect()
    const room = host.getBoundingClientRect()
    paint(revealedGrid(view.current, box, room))
  }

  function fit(indices?: readonly number[]) {
    const host = viewport.current
    if (host === null || world.current === null) return
    const room = host.getBoundingClientRect()
    const next =
      indices === undefined
        ? fittedGridRows(geometryRef.current, room)
        : fittedGridCards(geometryRef.current, indices, room)
    if (next !== null) paintFit(next, indices !== undefined)
  }

  function elements(index: number, boxes: readonly PaintBox[], slideWidth: number) {
    const host = viewport.current
    if (host === null) return
    const next = fittedGridElements(geometryRef.current, index, boxes, slideWidth, host.getBoundingClientRect())
    if (next !== null) paintFit(next, true)
  }

  function paintFit(next: GridViewport, selection: boolean) {
    paint(next)
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    stopTimer()
    dirty.current = false
    if (!selection) {
      keepGridViewport(kept.current, null)
      fitted.current(next.scale * 100)
      return
    }
    fits.current = false
    keepGridViewport(kept.current, next)
    zoom.current(next.scale * 100, false)
  }

  return {
    reset: () => fit(),
    elements,
    selection: (indices: readonly number[]) => fit(indices),
    space,
    panBy: (delta: { readonly x: number; readonly y: number }) => {
      paint(pannedGrid(view.current, delta))
      stopTimer()
      dirty.current = true
      fits.current = false
    },
    panEnd: () => {
      if (dirty.current) settle()
    },
    handlers: {
      ref: viewport,
      tabIndex: -1,
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (pan.current === null && !dragged.current) return
        dragged.current = false
        event.preventDefault()
        event.stopPropagation()
      },
      onPointerDownCapture: press,
      onPointerMove: move,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onFocusCapture: (event: FocusEvent<HTMLDivElement>) => {
        if (event.target.matches("[data-slide-entry]")) {
          focused.current = Number(event.target.getAttribute("data-slide-entry")) - 1
          reveal(event.target)
        } else if (event.target.matches("[data-row-handle]")) reveal(event.target)
      },
    },
  }
}

const GridThumbnailPaint = memo(function GridThumbnailPaint({
  paint,
  index,
  width,
}: {
  paint: (index: number, width: number) => ReactNode
  index: number
  width: number
}) {
  return paint(index, width)
})

export function GridThumbnail({
  paint,
  index,
  width,
  scale,
}: {
  paint: (index: number, width: number) => ReactNode
  index: number
  width: number
  scale: number
}) {
  return createElement(
    "div",
    { style: { width, transform: `scale(${scale})`, transformOrigin: "0 0" } },
    createElement(GridThumbnailPaint, { paint, index, width }),
  )
}
