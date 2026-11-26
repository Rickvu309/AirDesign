import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { gestureFor, releases } from "@/lib/gestures"
import { steppedZoom, zoomKey, zoomRanges, type Zoom } from "@/editing/canvas-zoom"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import type { GridLayout, GridRect, GridSize } from "@/editor/grid-lines"
import {
  arrowGrid,
  boundedGridScale,
  fittedGrid,
  fittedGridCards,
  pannedGrid,
  readGridViewport,
  resizedGrid,
  revealedGrid,
  wheeledGrid,
  zoomedGrid,
  zoomedGridBy,
  type GridCamera,
  type GridView,
} from "@/editor/grid-viewport"
import { typing } from "./use-canvas-keys"

const settleAfter = 180

type SafariGesture = Event & { readonly scale?: number; readonly clientX?: number; readonly clientY?: number }

const place = (deck: string) => `airdesign.grid-viewport.${deck}`

function keptCamera(deck: string): GridCamera {
  try {
    return readGridViewport(localStorage.getItem(place(deck))) ?? "fit"
  } catch {
    return "fit"
  }
}

function keepCamera(deck: string, camera: GridCamera): void {
  try {
    if (camera === "fit") localStorage.removeItem(place(deck))
    else localStorage.setItem(place(deck), JSON.stringify(camera))
  } catch {
    return
  }
}

export function blankCanvas(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-grid-card]") === null
}

function onCanvas(target: EventTarget | null, host: HTMLElement | null): boolean {
  return target === document.body || (target instanceof Element && host !== null && host.contains(target))
}

export function cardBox(layout: GridLayout, view: GridView, index: number): GridRect | null {
  const card = layout.cards[index]
  if (card === undefined) return null
  return {
    left: view.x + card.left * view.scale,
    top: view.y + card.top * view.scale,
    width: card.width * view.scale,
    height: card.height * view.scale,
  }
}

function union(boxes: readonly GridRect[]): GridRect | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return { left, top, width: right - left, height: bottom - top }
}

export function useGridCamera({
  deck,
  layout,
  ringed,
  hand,
  onHand,
  start,
}: {
  readonly deck: string
  readonly layout: GridLayout
  readonly ringed: readonly number[]
  readonly hand: boolean
  readonly onHand: (hand: boolean) => void
  readonly start?: GridView
}) {
  const [camera, setCamera] = useState<GridCamera>(() => start ?? keptCamera(deck))
  const [room, setRoom] = useState<GridSize>({ width: 0, height: 0 })
  const [space, setSpace] = useState(false)
  const host = useRef<HTMLDivElement | null>(null)
  const view = camera === "fit" ? fittedGrid(layout, room) : camera
  const latest = useRef({ camera, view, layout, ringed, room, hand, onHand })
  useLayoutEffect(() => {
    latest.current = { camera, view, layout, ringed, room, hand, onHand }
  })
  const pan = useRef<{ pointer: number; x: number; y: number; view: GridView } | null>(null)
  const panned = useRef(false)
  const heldSpace = useRef(false)

  function show(next: GridCamera) {
    latest.current = { ...latest.current, camera: next, view: next === "fit" ? latest.current.view : next }
    setCamera(next)
  }

  function center() {
    return { x: latest.current.room.width / 2, y: latest.current.room.height / 2 }
  }

  function local(point: { readonly x: number; readonly y: number }) {
    const box = host.current?.getBoundingClientRect()
    return { x: point.x - (box?.left ?? 0), y: point.y - (box?.top ?? 0) }
  }

  function reveal(index: number) {
    const { view: now, layout: laid, room: size } = latest.current
    const box = cardBox(laid, now, index)
    if (box === null) return
    const next = revealedGrid(now, box, { left: 0, top: 0, ...size })
    if (next !== now) show(next)
  }

  function zoomTo(zoom: Zoom, focus: number | undefined) {
    if (zoom === "fit") {
      show("fit")
      return
    }
    show(zoomedGrid(latest.current.view, boundedGridScale(zoom / 100), center()))
    if (focus !== undefined) reveal(focus)
  }

  function zoomSelection() {
    const { layout: laid, ringed: picked, room: size } = latest.current
    const next = fittedGridCards(laid, picked, size)
    if (next !== null) show(next)
  }

  useEffect(() => {
    const timer = setTimeout(() => keepCamera(deck, camera), settleAfter)
    return () => clearTimeout(timer)
  }, [deck, camera])

  useEffect(() => {
    const store = () => keepCamera(deck, latest.current.camera)
    window.addEventListener("pagehide", store)
    return () => {
      window.removeEventListener("pagehide", store)
      store()
    }
  }, [deck])

  useLayoutEffect(() => {
    const element = host.current
    if (element === null) return
    let before = element.getBoundingClientRect()
    setRoom({ width: before.width, height: before.height })
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(() => {
      const after = element.getBoundingClientRect()
      const { camera: shown, layout: laid, ringed: picked } = latest.current
      if (shown !== "fit") {
        const boxes = picked.flatMap((index) => cardBox(laid, shown, index) ?? [])
        const target = union(boxes.map((box) => ({ ...box, left: box.left + before.left, top: box.top + before.top })))
        if (target !== null) {
          const next = resizedGrid(shown, target, before, after)
          if (next !== shown) show(next)
        }
      }
      setRoom((held) =>
        held.width === after.width && held.height === after.height
          ? held
          : { width: after.width, height: after.height },
      )
      before = after
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = host.current
    if (element === null) return
    let pinching: number | null = null
    let pointer: { x: number; y: number } | null = null
    const move = (event: globalThis.PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
    }
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (pinching !== null && (event.ctrlKey || event.metaKey)) return
      show(wheeledGrid(latest.current.view, event, local({ x: event.clientX, y: event.clientY })))
    }
    const start = (raw: Event) => {
      raw.preventDefault()
      pinching = (raw as SafariGesture).scale ?? 1
    }
    const change = (raw: Event) => {
      const event = raw as SafariGesture
      event.preventDefault()
      const scale = event.scale
      if (pinching === null || scale === undefined || !Number.isFinite(scale) || scale <= 0) return
      const factor = scale / pinching
      pinching = scale
      const at =
        event.clientX !== undefined && event.clientY !== undefined && (event.clientX !== 0 || event.clientY !== 0)
          ? { x: event.clientX, y: event.clientY }
          : pointer
      show(zoomedGridBy(latest.current.view, factor, at === null ? center() : local(at)))
    }
    const end = (raw: Event) => {
      raw.preventDefault()
      pinching = null
    }
    element.addEventListener("pointermove", move, { passive: true })
    element.addEventListener("wheel", wheel, { passive: false })
    element.addEventListener("gesturestart", start, { passive: false })
    element.addEventListener("gesturechange", change, { passive: false })
    element.addEventListener("gestureend", end, { passive: false })
    return () => {
      element.removeEventListener("pointermove", move)
      element.removeEventListener("wheel", wheel)
      element.removeEventListener("gesturestart", start)
      element.removeEventListener("gesturechange", change)
      element.removeEventListener("gestureend", end)
    }
  }, [])

  useEffect(() => {
    const release = () => {
      heldSpace.current = false
      setSpace(false)
    }
    const down = (event: KeyboardEvent) => {
      if (event.isComposing || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if (gesture === "tool-hand" || gesture === "tool-move") {
        if (!editorOwnsKey(event)) return
        event.preventDefault()
        latest.current.onHand(gesture === "tool-hand")
        return
      }
      if (gesture === "pan" && onCanvas(event.target, host.current)) {
        if (!editorOwnsKey(event)) return
        event.preventDefault()
        event.stopPropagation()
        heldSpace.current = true
        setSpace(true)
        return
      }
      const zoom = zoomKey({
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        field: false,
      })
      if (zoom !== null) {
        if (!editorOwnsKey(event)) return
        event.preventDefault()
        const percent = Math.round(latest.current.view.scale * 100)
        if (zoom === "selection") zoomSelection()
        else if (zoom === "fit") show("fit")
        else zoomTo(zoom === "actual" ? 100 : steppedZoom(zoom, percent, zoomRanges.grid), latest.current.ringed[0])
        return
      }
      if (gestureFor(event, "grid") !== "pan-arrows") return
      if (!onCanvas(event.target, host.current) || !blankCanvas(event.target) || !editorOwnsKey(event)) return
      event.preventDefault()
      show(arrowGrid(latest.current.view, event.key))
    }
    const up = (event: KeyboardEvent) => {
      if (releases(event, "pan")) release()
    }
    window.addEventListener("keydown", down, true)
    window.addEventListener("keyup", up, true)
    window.addEventListener("blur", release)
    return () => {
      window.removeEventListener("keydown", down, true)
      window.removeEventListener("keyup", up, true)
      window.removeEventListener("blur", release)
    }
  }, [])

  function press(event: PointerEvent<HTMLDivElement>) {
    const touch = event.pointerType === "touch" && blankCanvas(event.target)
    if (event.button !== 1 && !(event.button === 0 && (latest.current.hand || heldSpace.current || touch))) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.panning = "true"
    panned.current = false
    pan.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, view: latest.current.view }
  }

  function follow(event: PointerEvent<HTMLDivElement>) {
    const held = pan.current
    if (held === null || held.pointer !== event.pointerId) return
    panned.current = true
    show(pannedGrid(held.view, { x: event.clientX - held.x, y: event.clientY - held.y }))
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer !== event.pointerId) return
    pan.current = null
    delete event.currentTarget.dataset.panning
  }

  return {
    view,
    fit: camera === "fit",
    room,
    space,
    reveal,
    zoomTo,
    zoomSelection,
    panBy: (delta: { readonly x: number; readonly y: number }) => show(pannedGrid(latest.current.view, delta)),
    world: (point: { readonly x: number; readonly y: number }) => {
      const at = local(point)
      const { view: now } = latest.current
      return { x: (at.x - now.x) / now.scale, y: (at.y - now.y) / now.scale }
    },
    handlers: {
      ref: host,
      onPointerDownCapture: press,
      onPointerMove: follow,
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (!panned.current) return
        panned.current = false
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}
