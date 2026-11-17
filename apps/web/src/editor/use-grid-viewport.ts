import { useLayoutEffect, useRef, type PointerEvent, type FocusEvent, type RefObject } from "react"
import {
  zoomedGrid,
  pannedGrid,
  boundedGridScale,
  fittedGridCards,
  revealedGrid,
  type GridViewport,
} from "@/editor/grid-viewport"

export function useGridViewport({
  world,
  scale,
  hand,
  onZoom,
  initialFit,
  layout,
  fitting,
  onFit,
  selected,
}: {
  world: RefObject<HTMLDivElement | null>
  scale: number
  hand: boolean
  onZoom: (size: number) => void
  onFit: (percent: number) => void
  layout: string
  fitting: boolean
  initialFit: boolean
  selected: number
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const view = useRef<GridViewport>({ x: 48, y: 24, scale })
  const pan = useRef<{ pointer: number; x: number; y: number; view: GridViewport } | null>(null)
  const first = useRef(initialFit)
  const fits = useRef(fitting)
  fits.current = fitting
  const fitted = useRef(onFit)
  fitted.current = onFit
  const zoom = useRef(onZoom)
  zoom.current = onZoom

  function paint(next: GridViewport) {
    view.current = next
    if (world.current !== null)
      world.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`
  }

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    const changed = view.current.scale !== scale
    if (first.current) {
      first.current = false
      paint(view.current)
      fit()
      return
    }
    paint(zoomedGrid(view.current, scale, { x: host.clientWidth / 2, y: host.clientHeight / 2 }))
    if (changed) {
      const card = world.current?.querySelector(`[data-slide-entry="${selected + 1}"]`)
      if (card) reveal(card)
    }
  }, [scale])

  useLayoutEffect(() => {
    if (fits.current) fit()
  }, [layout])

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        const box = host.getBoundingClientRect()
        const next = boundedGridScale(view.current.scale * Math.exp(-event.deltaY * 0.01)) * 100
        paint(zoomedGrid(view.current, next / 100, { x: event.clientX - box.left, y: event.clientY - box.top }))
        zoom.current(next)
      } else {
        paint(pannedGrid(view.current, { x: -event.deltaX, y: -event.deltaY }))
      }
    }
    host.addEventListener("wheel", wheel, { passive: false })
    return () => host.removeEventListener("wheel", wheel)
  }, [])

  useLayoutEffect(() => {
    const host = viewport.current
    if (host === null) return
    const observer = new ResizeObserver(() => {
      if (fits.current) {
        fit()
        return
      }
      if (document.activeElement instanceof Element) reveal(document.activeElement)
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  function press(event: PointerEvent<HTMLDivElement>) {
    const target = event.target
    const blank = target instanceof Element && target.closest("[data-grid-card], [data-section-head]") === null
    if (event.button !== 1 && !(event.button === 0 && (hand || blank))) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pan.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, view: view.current }
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const held = pan.current
    if (held === null || held.pointer !== event.pointerId) return
    paint(pannedGrid(held.view, { x: event.clientX - held.x, y: event.clientY - held.y }))
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer === event.pointerId) pan.current = null
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

  function fit() {
    const host = viewport.current
    const content = world.current
    if (!host || !content) return
    const cards = [...content.querySelectorAll("[data-grid-card]")].map((card) => card.getBoundingClientRect())
    const next = fittedGridCards(view.current, cards, host.getBoundingClientRect())
    paint(next)
    fitted.current(next.scale * 100)
  }

  return {
    reset: fit,
    handlers: {
      ref: viewport,
      onPointerDownCapture: press,
      onPointerMove: move,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onFocusCapture: (event: FocusEvent<HTMLDivElement>) => reveal(event.target),
    },
  }
}
