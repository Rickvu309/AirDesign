import { gestureFor, releases, type PaintBox } from "@airdesign/render"
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
  fittedGridGroups,
  resizedGrid,
  type GridGeometry,
  revealedGrid,
  gridScaleMoved,
  gridCardBounds,
  gridElementBounds,
  gridScreenFixed,
  exposedGrid,
  type GridViewport,
} from "@/editor/grid-viewport"
import { gridBlank } from "@/editor/grid-hit"
import { keptGridViewport, keepGridViewport } from "@/editor/grid-zoom"

const settleAfter = 180

function unionBounds(boxes: readonly { left: number; top: number; width: number; height: number }[]) {
  const first = boxes[0]
  if (first === undefined) return null
  let left = first.left
  let top = first.top
  let right = left + first.width
  let bottom = top + first.height
  for (const box of boxes.slice(1)) {
    left = Math.min(left, box.left)
    top = Math.min(top, box.top)
    right = Math.max(right, box.left + box.width)
    bottom = Math.max(bottom, box.top + box.height)
  }
  return { left, top, width: right - left, height: bottom - top }
}

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
    target.closest("[data-slide-entry], [data-group-handle]") !== null ||
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
  elementsOf,
  slideWidth = geometry.width,
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
  elementsOf?: () => readonly PaintBox[] | undefined
  slideWidth?: number
}) {
  const focused = useRef(selected)
  const previous = useRef(selected)
  if (previous.current !== selected) focused.current = selected
  previous.current = selected
  const workingBounds = useRef({ elementsOf, slideWidth, selected })
  workingBounds.current = { elementsOf, slideWidth, selected }
  const focusing = useRef(false)
  const geometryRef = useRef(geometry)
  geometryRef.current = geometry
  const frame = useRef<number | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const openRoom = useRef<DOMRect | null>(null)
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
      if (gestureFor(event, "editor") === "pan") {
        if (!spacePans(event.target, viewport.current)) return
        event.preventDefault()
        event.stopPropagation()
        heldSpace.current = true
        setSpace(true)
        return
      }
      if (gestureFor(event, "grid") !== "pan-arrows" || !canvasKeyTarget(event.target, viewport.current)) return
      event.preventDefault()
      paint(arrowGrid(view.current, event.key))
      settle()
    }
    function up(event: KeyboardEvent) {
      if (releases(event, "pan")) release()
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
    const content = world.current
    const host = viewport.current
    if (content === null || host === null) return
    content.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`
  }

  function screenFixed(indices: readonly number[]): number {
    const values = indices.map((index) => gridScreenFixed(geometryRef.current, index))
    return values.length === 0 ? 0 : (Math.min(...values) + Math.max(...values)) / 2
  }

  function workingTarget() {
    const content = world.current
    if (content === null) return null
    const working = workingBounds.current
    const elements = working.elementsOf?.() ?? []
    if (elements.length > 0) {
      const card = content.querySelector(`[data-slide-entry="${working.selected + 1}"]`)
      if (card === null) return null
      const face = card.getBoundingClientRect()
      const boxes = gridElementBounds(elements, face.width / working.slideWidth)
      const box =
        boxes === null
          ? face
          : { left: face.left + boxes.left, top: face.top + boxes.top, width: boxes.width, height: boxes.height }
      return { box, fixed: gridScreenFixed(geometryRef.current, working.selected) }
    }
    const focusedIndex = focused.current
    const focusedCard = content.querySelector<HTMLElement>(`[data-slide-entry="${focusedIndex + 1}"]`)
    const selectedCards = [...content.querySelectorAll<HTMLElement>("[data-slide-entry][data-selected]")]
    const indices = selectedCards.map((card) => Number(card.dataset.slideEntry) - 1)
    if (selectedCards.length > 0 && (focusedCard === null || indices.includes(focusedIndex))) {
      const box = unionBounds(selectedCards.map((card) => card.getBoundingClientRect()))
      if (box === null) return null
      return { box, fixed: screenFixed(indices) }
    }
    if (focusedCard === null) return null
    return {
      box: focusedCard.getBoundingClientRect(),
      fixed: gridScreenFixed(geometryRef.current, focusedIndex),
    }
  }

  function applyFitted(next: GridViewport) {
    if (next === view.current) return
    const moved = gridScaleMoved(view.current, next.scale)
    paint(next)
    settle()
    if (!moved) return
    flushSync(() => zoom.current(view.current.scale * 100, false))
  }

  function placeSelection() {
    if (fits.current) return
    const wide = openRoom.current
    const host = viewport.current
    if (wide === null || host === null) return
    const target = workingTarget()
    if (target === null) return
    applyFitted(resizedGrid(view.current, target.box, wide, host.getBoundingClientRect(), target.fixed))
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
      if (after.width < before.width - 0.5) {
        if (openRoom.current === null || before.width > openRoom.current.width + 0.5) openRoom.current = before
      } else if (openRoom.current !== null && after.width >= openRoom.current.width - 0.5) openRoom.current = null
      if (fits.current) flushSync(() => fit())
      else {
        const target = workingTarget()
        if (target !== null) applyFitted(resizedGrid(view.current, target.box, before, after, target.fixed))
      }
      before = after
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const elementKey = (elementsOf?.() ?? [])
    .map((box) => `${box.x}:${box.y}:${box.width}:${box.height}:${box.rotation}`)
    .join(";")
  useLayoutEffect(() => {
    placeSelection()
  }, [elementKey, selected])

  useLayoutEffect(() => {
    const content = world.current
    if (content === null || typeof MutationObserver === "undefined") return
    const observer = new MutationObserver(() => placeSelection())
    observer.observe(content, { subtree: true, attributes: true, attributeFilter: ["data-selected"] })
    return () => observer.disconnect()
  }, [])

  function press(event: PointerEvent<HTMLDivElement>) {
    const blank = gridBlank(event.target)
    const touch = blank && event.pointerType === "touch"
    if (event.button !== 1 && !(event.button === 0 && (hand || heldSpace.current || touch))) return
    dragged.current = hand || heldSpace.current || event.button === 1
    if (blank) event.currentTarget.focus({ preventScroll: true, focusVisible: false })
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
    const card = target.closest("[data-grid-card], [data-group-handle]")
    if (host === null || card === null) return
    host.scrollLeft = 0
    host.scrollTop = 0
    const box = card.getBoundingClientRect()
    const entry = card.querySelector("[data-slide-entry]")
    const bounds =
      entry === null
        ? box
        : gridCardBounds(
            geometryRef.current,
            Number(entry.getAttribute("data-slide-entry")) - 1,
            view.current.scale,
            box,
            24,
          )
    const room = host.getBoundingClientRect()
    paint(revealedGrid(view.current, bounds, room, bounds.left < box.left))
  }

  function fit(indices?: readonly number[]) {
    const host = viewport.current
    if (host === null || world.current === null) return
    const room = host.getBoundingClientRect()
    const next =
      indices === undefined
        ? fittedGridGroups(geometryRef.current, room)
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
    fits.current = !selection
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
    keepGridViewport(kept.current, next)
    zoom.current(next.scale * 100, false)
  }

  function focus(card: HTMLElement, visible = false) {
    const host = viewport.current
    if (host === null) return
    focusing.current = true
    card.focus({ preventScroll: true, focusVisible: visible })
    focusing.current = false
    focused.current = Number(card.getAttribute("data-slide-entry")) - 1
    const next = exposedGrid(view.current, card.getBoundingClientRect(), host.getBoundingClientRect())
    if (next !== view.current) {
      paint(next)
      settle()
    }
  }

  return {
    reset: () => fit(),
    focus,
    reveal,
    elements,
    selection: (indices: readonly number[]) => fit(indices),
    space,
    panBy: (delta: { readonly x: number; readonly y: number }) => {
      fits.current = false
      paint(pannedGrid(view.current, delta))
      stopTimer()
      dirty.current = true
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
        if (focusing.current) return
        if (event.target.matches("[data-slide-entry]")) {
          focused.current = Number(event.target.getAttribute("data-slide-entry")) - 1
          reveal(event.target)
        } else if (event.target.matches("[data-group-handle]")) reveal(event.target)
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
