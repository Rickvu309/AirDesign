import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react"
import { gestureFor } from "@/lib/gestures"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import {
  dropAt,
  dropPlace,
  gridBands,
  gridDrop,
  gridIndices,
  groupBar,
  groupDrop,
  groupPan,
  liveTarget,
  previewSlot,
  slideBar,
  slotUnder,
  type GridDrop,
  type GridRange,
} from "@/editor/grid-drop"
import { gridSpacing, type GridLayout, type GridRect } from "@/editor/grid-lines"
import { dragStarted, edgePan } from "@/editor/grid-marquee"
import type { GridMoveSide } from "@/editor/grid-move"
import { gridGrip } from "@/editor/grid-viewport"
import type { useGridCamera } from "@/editor/use-grid-camera"

type Point = { readonly x: number; readonly y: number }

export type GridDragPreview = {
  readonly group: boolean
  readonly from: number
  readonly to: number | null
  readonly moving: boolean
  readonly held: readonly number[]
}

export type GridDropBar = { readonly at: number; readonly group: boolean; readonly rect: GridRect }

type Press = {
  readonly shape: string
  readonly group: boolean
  readonly pointer: number
  readonly index: number
  readonly start: Point
  readonly dragged: boolean
}

const frameTime = 1000 / 60
const ghostOffset = 12

function rangeOf(groups: readonly GridRange[], index: number): GridRange | undefined {
  return groups.find((group) => index >= group.start && index < group.end)
}

function inside(point: Point, room: DOMRect): boolean {
  return point.x >= room.left && point.x <= room.right && point.y >= room.top && point.y <= room.bottom
}

function reduced(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
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
  camera,
  layout,
  groups,
  selected,
  shape,
  panning,
  ghost,
  onMove,
}: {
  readonly camera: Pick<ReturnType<typeof useGridCamera>, "handlers" | "panBy" | "world" | "view">
  readonly layout: GridLayout
  readonly groups: readonly GridRange[]
  readonly selected: readonly number[]
  readonly shape: string
  readonly panning: boolean
  readonly ghost: RefObject<HTMLDivElement | null>
  readonly onMove: (held: readonly number[], at: number, side: GridMoveSide) => void
}) {
  const press = useRef<Press | null>(null)
  const pointer = useRef<Point | null>(null)
  const active = useRef<GridDragPreview | null>(null)
  const place = useRef<GridDrop | null>(null)
  const frame = useRef<number | null>(null)
  const clock = useRef(0)
  const [preview, setPreview] = useState<GridDragPreview | null>(null)
  const [bar, setBar] = useState<GridDropBar | null>(null)
  const [still, setStill] = useState(false)

  function show(next: GridDragPreview | null) {
    active.current = next
    setPreview(next)
  }

  function mark(next: GridDropBar | null) {
    setBar((held) =>
      held !== null &&
      next !== null &&
      held.at === next.at &&
      held.group === next.group &&
      held.rect.left === next.rect.left &&
      held.rect.top === next.rect.top
        ? held
        : next,
    )
  }

  function placeGhost(point: Point) {
    const image = ghost.current
    if (image === null) return
    const x = Math.max(
      ghostOffset,
      Math.min(point.x + ghostOffset, window.innerWidth - image.offsetWidth - ghostOffset),
    )
    const y = Math.max(
      ghostOffset,
      Math.min(point.y + ghostOffset, window.innerHeight - image.offsetHeight - ghostOffset),
    )
    image.style.transform = `translate(${String(x)}px, ${String(y)}px)`
  }

  function end() {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
    pointer.current = null
    place.current = null
    show(null)
    mark(null)
  }

  function clearPlace(held: GridDragPreview) {
    place.current = null
    mark(null)
    if (held.to !== null) show({ ...held, to: null })
  }

  function locate(point: Point) {
    const held = active.current
    const room = camera.handlers.ref.current?.getBoundingClientRect()
    if (held === null) return
    if (room === undefined || !inside(point, room)) {
      clearPlace(held)
      return
    }
    const world = camera.world(point)
    const scale = camera.view.scale
    if (held.group) {
      const leading = (gridGrip.offset + gridGrip.width / 2) / scale
      if (world.x < -leading || world.x > layout.width) {
        clearPlace(held)
        return
      }
      const drop = groupDrop(gridBands(layout), world.y, scale)
      if (drop === null || gridDrop(groups, held.held, drop.at, "keep") === null) {
        clearPlace(held)
        return
      }
      place.current = { at: drop.at, side: "keep" }
      mark({ at: drop.at, group: true, rect: groupBar(drop.top, layout) })
      return
    }
    const first = layout.cards[0]
    const gaps = first === undefined ? { column: 0, line: 0 } : gridSpacing(first)
    const slot = slotUnder(world, layout.cards, groups, gaps)
    if (slot === undefined) {
      clearPlace(held)
      return
    }
    const candidate = dropAt(groups, held.held, slot.index, dropPlace(world.x, slot, slot.index))
    const band = rangeOf(groups, slot.index)
    const withinHeld = band !== undefined && gridIndices(band).every((index) => held.held.includes(index))
    if (withinHeld || gridDrop(groups, held.held, candidate.at, candidate.side) === null) {
      clearPlace(held)
      return
    }
    place.current = candidate
    const next = held.moving ? liveTarget(groups, held.from, slot.index, candidate.at) : null
    if (next !== null) mark(null)
    else {
      const beside = layout.cards.find((card) => card.index === candidate.at && candidate.at !== slot.index + 1) ?? slot
      mark({ at: candidate.at, group: false, rect: slideBar(beside, candidate.at, beside.index, gaps.column) })
    }
    if (next !== held.to) show({ ...held, to: next })
  }

  function begin(index: number, group: boolean) {
    const range = rangeOf(groups, index)
    const held = group && range !== undefined ? gridIndices(range) : selected.includes(index) ? selected : [index]
    const quiet = reduced()
    setStill(quiet)
    show({ group, from: index, to: null, moving: !group && !quiet && held.length === 1, held })
    clock.current = performance.now()
    frame.current = requestAnimationFrame((time) => latest.current.step(time))
  }

  function step(time: number) {
    const held = active.current
    if (held === null) {
      frame.current = null
      return
    }
    const beats = Math.min(4, (time - clock.current) / frameTime)
    clock.current = time
    const point = pointer.current
    const host = camera.handlers.ref.current
    if (point !== null && host !== null) {
      const speed = edgePan(point, host.getBoundingClientRect())
      if (speed.x !== 0 || speed.y !== 0) {
        let y = speed.y * beats
        const bands = gridBands(layout)
        const top = bands[0]?.top
        const bottom = bands.at(-1)?.bottom
        if (held.group && y !== 0 && top !== undefined && bottom !== undefined) {
          const box = host.getBoundingClientRect()
          const { view } = camera
          y = groupPan(y, point.y, box.top + view.y + top * view.scale, box.top + view.y + bottom * view.scale)
        }
        const x = speed.x * beats
        if (x !== 0 || y !== 0) camera.panBy({ x, y })
        locate(point)
      }
    }
    frame.current = requestAnimationFrame((next) => latest.current.step(next))
  }

  function follow(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    const point = { x: event.clientX, y: event.clientY }
    if (!held.dragged) {
      if (!dragStarted(held.start, point)) return
      if (held.shape !== shape) {
        press.current = null
        return
      }
      press.current = { ...held, dragged: true }
      begin(held.index, held.group)
    }
    if (active.current === null) return
    document.getSelection()?.removeAllRanges()
    pointer.current = point
    placeGhost(point)
    locate(point)
  }

  function release(event: globalThis.PointerEvent) {
    const held = press.current
    if (held === null || held.pointer !== event.pointerId) return
    press.current = null
    if (!held.dragged) return
    swallowClick()
    const drag = active.current
    if (drag === null) return
    locate({ x: event.clientX, y: event.clientY })
    const drop = place.current
    setStill(true)
    end()
    if (drop !== null) onMove(drag.held, drop.at, drop.side)
  }

  function cancel() {
    press.current = null
    if (active.current === null) return
    setStill(false)
    end()
  }

  function escape(event: KeyboardEvent) {
    if (active.current === null || gestureFor(event, "grid") !== "deselect" || !editorOwnsKey(event)) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  }

  const latest = useRef({ step, follow, release, escape, cancel })
  useLayoutEffect(() => {
    latest.current = { step, follow, release, escape, cancel }
  })

  useEffect(() => {
    const follow = (event: globalThis.PointerEvent) => latest.current.follow(event)
    const release = (event: globalThis.PointerEvent) => latest.current.release(event)
    const lost = (event: globalThis.PointerEvent) => {
      if (press.current?.pointer === event.pointerId) latest.current.cancel()
    }
    const escape = (event: KeyboardEvent) => latest.current.escape(event)
    const blur = () => latest.current.cancel()
    window.addEventListener("pointermove", follow)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", lost)
    window.addEventListener("keydown", escape, true)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("pointermove", follow)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", lost)
      window.removeEventListener("keydown", escape, true)
      window.removeEventListener("blur", blur)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (press.current === null || press.current.shape === shape) return
    latest.current.cancel()
  }, [shape])

  useLayoutEffect(() => {
    if (panning) latest.current.cancel()
  }, [panning])

  const dragging = preview !== null
  useLayoutEffect(() => {
    if (dragging && pointer.current !== null) placeGhost(pointer.current)
  }, [dragging])

  function shift(index: number): Point | null {
    if (preview === null) return null
    const target = previewSlot(index, preview.from, preview.to)
    const here = layout.cards[index]
    const there = layout.cards[target]
    if (here === undefined || there === undefined || target === index) return null
    return { x: there.left - here.left, y: there.top - here.top }
  }

  return {
    preview,
    bar,
    still,
    shift,
    grab: (index: number, event: PointerEvent<HTMLElement>, group = false) => {
      if (event.button !== 0 || !event.isPrimary || press.current !== null) return
      press.current = {
        shape,
        group,
        pointer: event.pointerId,
        index,
        start: { x: event.clientX, y: event.clientY },
        dragged: false,
      }
    },
  }
}
