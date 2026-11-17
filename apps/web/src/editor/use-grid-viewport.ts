import {
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
  return target.closest("[data-slide-entry]") !== null || target.closest("button, a[href], [role=button]") === null
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
}) {
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
    }
  }, [])

  useLayoutEffect(() => {
    if (!working) return
    function release() {
      heldSpace.current = false
      setSpace(false)
    }
    function down(event: KeyboardEvent) {
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
    }
    host.addEventListener("wheel", wheel, { passive: false })
    return () => host.removeEventListener("wheel", wheel)
  }, [])

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    const observer = new ResizeObserver(() => {
      if (fits.current) flushSync(() => fit())
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  function press(event: PointerEvent<HTMLDivElement>) {
    const target = event.target
    const blank = target instanceof Element && target.closest("[data-grid-card], [data-section-head]") === null
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
    const card = target.closest("[data-grid-card]")
    if (host === null || card === null) return
    host.scrollLeft = 0
    host.scrollTop = 0
    const box = card.getBoundingClientRect()
    const room = host.getBoundingClientRect()
    paint(revealedGrid(view.current, box, room))
  }

  function fit(indices?: readonly number[]) {
    const host = viewport.current
    const content = world.current
    if (!host || !content) return
    const wanted = indices === undefined ? null : new Set(indices.map((index) => String(index + 1)))
    const cards = [...content.querySelectorAll("[data-grid-card]")]
      .filter((card) => {
        const entry = card.querySelector("[data-slide-entry]")?.getAttribute("data-slide-entry")
        return wanted === null || (entry !== null && entry !== undefined && wanted.has(entry))
      })
      .map((card) => card.getBoundingClientRect())
    if (wanted !== null && cards.length === 0) return
    const next = fittedGridCards(view.current, cards, host.getBoundingClientRect())
    paint(next)
    stopTimer()
    dirty.current = false
    if (wanted === null) {
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
        if (event.target.matches("[data-slide-entry]")) reveal(event.target)
      },
    },
  }
}
