import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react"
import { dropPlace, dropTarget, edgePan, previewSlot, slotUnder, type GridSlot } from "@/editor/grid-drop"
import { cardPress } from "@/editor/grid-hit"
import { gridSpacing } from "@/editor/grid-viewport"
import { still } from "@/editor/slide-opening"

type Range = { readonly start: number; readonly end: number }

type Point = { readonly x: number; readonly y: number }

type Preview = {
  readonly from: number
  readonly to: number | null
  readonly moving: boolean
  readonly held: readonly number[]
}

type Press = {
  readonly pointer: number
  readonly index: number
  readonly start: Point
  readonly dragged: boolean
  readonly shift: boolean
  readonly toggle: boolean
}

const slideMotion = "transform var(--ease-panel)"

const slop = 4

const frameTime = 1000 / 60

const ghostOffset = 12

function rowOf(rows: readonly Range[], index: number): Range | undefined {
  return rows.find((row) => index >= row.start && index < row.end)
}

function slotsIn(scroller: HTMLElement): readonly GridSlot[] {
  const box = scroller.getBoundingClientRect()
  const scale = scroller.offsetWidth === 0 ? 1 : box.width / scroller.offsetWidth
  return [...scroller.querySelectorAll<HTMLElement>("[data-slide-entry]")].map((card) => {
    const rect = card.getBoundingClientRect()
    return {
      index: Number(card.dataset.slideEntry) - 1,
      left: (rect.left - box.left) / scale,
      top: (rect.top - box.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }
  })
}

function inside(point: Point, room: DOMRect): boolean {
  return point.x >= room.left && point.x <= room.right && point.y >= room.top && point.y <= room.bottom
}

function swallowClick() {
  const stop = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener("click", stop, { capture: true, once: true })
  window.setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0)
}

export function useGridDrag({
  list,
  bar,
  ghost,
  viewport,
  rows,
  selected,
  panBy,
  onPanEnd,
  onMove,
  onPick,
}: {
  list: RefObject<HTMLDivElement | null>
  bar: RefObject<HTMLDivElement | null>
  ghost: RefObject<HTMLDivElement | null>
  viewport: RefObject<HTMLDivElement | null>
  rows: readonly Range[]
  selected: readonly number[]
  panBy: (delta: Point) => void
  onPanEnd: () => void
  onPick: (index: number, shift: boolean, toggle: boolean) => void
  onMove: (held: readonly number[], at: number) => void
}) {
  const press = useRef<Press | null>(null)
  const pointer = useRef<Point | null>(null)
  const active = useRef<Preview | null>(null)
  const frame = useRef<number | null>(null)
  const clock = useRef(0)
  const place = useRef<number | null>(null)
  const slots = useRef<readonly GridSlot[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [settling, setSettling] = useState(false)
  const [calm, setCalm] = useState(false)

  function show(next: Preview | null) {
    active.current = next
    setPreview(next)
  }

  function hideBar() {
    const mark = bar.current
    if (mark !== null) mark.hidden = true
  }

  function showBar(at: number, index: number) {
    const mark = bar.current
    const after = at !== index || rows.some((row) => row.start === at && at > 0)
    const slot = slots.current.find((each) => each.index === (after ? at - 1 : index))
    const world = list.current
    if (mark === null || slot === undefined || world === null) {
      place.current = null
      hideBar()
      return
    }
    const gap = gridSpacing(slot.width, slot.height).column
    const scale = world.offsetWidth === 0 ? 1 : world.getBoundingClientRect().width / world.offsetWidth
    const left = after ? slot.left + slot.width + gap / 2 : slot.left - gap / 2
    mark.hidden = false
    mark.dataset.dropPlace = String(at + 1)
    mark.style.height = `${slot.height}px`
    mark.style.transform = `translate(${left - 2 / scale}px, ${slot.top}px)`
  }

  function placeGhost(point: Point) {
    const image = ghost.current
    if (image !== null) image.style.transform = `translate(${point.x + ghostOffset}px, ${point.y + ghostOffset}px)`
  }

  function end() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    pointer.current = null
    place.current = null
    slots.current = []
    onPanEnd()
    show(null)
    hideBar()
  }

  function grab(index: number, event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || press.current !== null) return
    if (cardPress(event) !== "slide") return
    press.current = {
      pointer: event.pointerId,
      index,
      start: { x: event.clientX, y: event.clientY },
      dragged: false,
      shift: event.shiftKey,
      toggle: event.metaKey || event.ctrlKey,
    }
  }

  function begin(index: number) {
    const world = list.current
    slots.current = world === null ? [] : slotsIn(world)
    const held = selected.includes(index) ? selected : [index]
    const quiet = still()
    setSettling(false)
    setCalm(quiet)
    show({ from: index, to: null, moving: !quiet && held.length === 1, held })
    clock.current = performance.now()
    frame.current = requestAnimationFrame((time) => latest.current.step(time))
  }

  function locate() {
    const point = pointer.current
    const world = list.current
    const held = active.current
    const room = viewport.current?.getBoundingClientRect()
    if (point === null || world === null || held === null || room === undefined) return
    if (!inside(point, room)) {
      place.current = null
      hideBar()
      if (held.to !== null) show({ ...held, to: null })
      return
    }
    const box = world.getBoundingClientRect()
    const scale = world.offsetWidth === 0 ? 1 : box.width / world.offsetWidth
    const x = (point.x - box.left) / scale
    const y = (point.y - box.top) / scale
    const slot = slotUnder(x, y, slots.current)
    if (slot === undefined) return
    const at = dropPlace(x, slot, slot.index)
    place.current = at
    const home = rowOf(rows, held.from)
    const moves =
      held.moving && home !== undefined && home === rowOf(rows, slot.index) && !(at === home.start && at > 0)
    if (moves) hideBar()
    else showBar(at, slot.index)
    const next = moves ? dropTarget(held.from, at) : null
    if (next !== held.to) show({ ...held, to: next })
  }

  function step(time: number) {
    if (active.current === null) {
      frame.current = null
      return
    }
    const beats = Math.min(4, (time - clock.current) / frameTime)
    clock.current = time
    const point = pointer.current
    const host = viewport.current
    if (point !== null && host !== null) {
      const speed = edgePan(point, host.getBoundingClientRect())
      if (speed.x !== 0 || speed.y !== 0) {
        panBy({ x: speed.x * beats, y: speed.y * beats })
        locate()
      }
    }
    frame.current = requestAnimationFrame((next) => latest.current.step(next))
  }

  function follow(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    const point = { x: event.clientX, y: event.clientY }
    if (!held.dragged) {
      if (Math.hypot(point.x - held.start.x, point.y - held.start.y) < slop) return
      press.current = { ...held, dragged: true }
      begin(held.index)
    }
    if (active.current === null) return
    document.getSelection()?.removeAllRanges()
    pointer.current = point
    placeGhost(point)
    locate()
  }

  function release(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    press.current = null
    swallowClick()
    if (!held.dragged) {
      onPick(held.index, held.shift, held.toggle)
      return
    }
    const drag = active.current
    if (drag === null) return
    const at = place.current
    const room = viewport.current?.getBoundingClientRect()
    const lands = at !== null && room !== undefined && inside({ x: event.clientX, y: event.clientY }, room)
    setSettling(lands)
    end()
    if (lands) onMove(drag.held, at)
  }

  function escape(event: globalThis.KeyboardEvent) {
    if (event.key !== "Escape" || active.current === null) return
    event.preventDefault()
    event.stopPropagation()
    setSettling(false)
    end()
  }

  function lose() {
    press.current = null
    if (active.current === null) return
    setSettling(false)
    end()
  }

  const latest = useRef({ step, follow, release, escape, lose })
  latest.current = { step, follow, release, escape, lose }

  useEffect(() => {
    const follow = (event: globalThis.PointerEvent) => latest.current.follow(event)
    const release = (event: globalThis.PointerEvent) => latest.current.release(event)
    const cancel = (event: globalThis.PointerEvent) => {
      if (press.current?.pointer === event.pointerId) latest.current.lose()
    }
    const escape = (event: globalThis.KeyboardEvent) => latest.current.escape(event)
    const lose = () => latest.current.lose()
    window.addEventListener("pointermove", follow)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", lose)
    return () => {
      window.removeEventListener("pointermove", follow)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", lose)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  const dragging = preview !== null

  useLayoutEffect(() => {
    if (dragging && pointer.current !== null) placeGhost(pointer.current)
  }, [dragging])

  function shift(index: number): CSSProperties | undefined {
    const transition = settling || calm ? "none" : slideMotion
    if (preview === null) return { transition }
    const target = previewSlot(index, preview.from, preview.to)
    const here = slots.current.find((slot) => slot.index === index)
    const there = slots.current.find((slot) => slot.index === target)
    if (here === undefined || there === undefined || target === index) return { transition }
    return { transform: `translate(${there.left - here.left}px, ${there.top - here.top}px)`, transition }
  }

  return { dragging: preview?.from ?? null, held: preview?.held ?? [], grab, shift }
}
