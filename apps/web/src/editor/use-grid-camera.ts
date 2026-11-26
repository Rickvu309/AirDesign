import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react"
import { gestureFor, releases } from "@/lib/gestures"
import { steppedZoom, zoomKey, zoomRanges, type Zoom } from "@/editing/canvas-zoom"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gridZoomPlacement } from "@/editor/grid-number"
import type { GridLayout, GridRect, GridSize } from "@/editor/grid-lines"
import type { GridElementFrame } from "@/editor/use-grid-editing"
import {
  arrowGrid,
  boundedGridScale,
  cardBox,
  fittedGrid,
  fittedGridCards,
  fittedGridElements,
  gridPaintMargin,
  gridShown,
  keptGridShows,
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

function union(boxes: readonly GridRect[]): GridRect | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return { left, top, width: right - left, height: bottom - top }
}

function paintWorld(sheet: HTMLElement, view: GridView, refresh: boolean) {
  sheet.style.transform = `translate(${String(view.x)}px, ${String(view.y)}px) scale(${String(view.scale)})`
  sheet.style.transformOrigin = "0 0"
  if (!refresh) return
  const value = String(view.scale)
  for (const node of sheet.querySelectorAll<HTMLElement>(
    "[data-grid-overlay], [data-slide-entry], [data-slide-skip-mark], [data-grid-group-frame], [data-group-insert], [data-gap-insert]",
  )) {
    node.style.transform = ""
    node.style.setProperty("--grid-scale", value)
  }
  for (const number of sheet.querySelectorAll<HTMLElement>("[data-slide-number]")) number.style.transform = ""
}

function writePercent(percent: number) {
  const root = document.querySelector("[data-zoom-readout]")
  if (root === null) return
  const next = `${String(percent)}%`
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    if (node.textContent?.endsWith("%") === true) {
      if (node.textContent !== next) node.textContent = next
      return
    }
    node = walker.nextNode()
  }
}

function sameCamera(held: GridCamera, next: GridCamera): boolean {
  if (held === "fit" || next === "fit") return held === next
  return held.x === next.x && held.y === next.y && held.scale === next.scale
}

export function useGridCamera({
  deck,
  layout,
  ringed,
  elements,
  hand,
  onHand,
  sheet,
  start,
}: {
  readonly deck: string
  readonly layout: GridLayout
  readonly ringed: readonly number[]
  readonly elements: GridElementFrame | null
  readonly hand: boolean
  readonly onHand: (hand: boolean) => void
  readonly sheet: RefObject<HTMLDivElement | null>
  readonly start?: GridView
}) {
  const [camera, setCamera] = useState<GridCamera>(() => start ?? keptCamera(deck))
  const [settled, setSettled] = useState(0)
  const [room, setRoom] = useState<GridSize>({ width: 0, height: 0 })
  const [space, setSpace] = useState(false)
  const host = useRef<HTMLDivElement | null>(null)
  const view = camera === "fit" ? fittedGrid(layout, room, layout.cards[0]?.height) : camera
  const latest = useRef({ camera, view, layout, ringed, elements, room, hand, onHand })
  const gliding = useRef(false)
  const rendered = useRef<GridCamera>(camera)
  const renderedScale = useRef<number | null>(null)
  const paintedKey = useRef("")
  const restTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [, setFrame] = useState(0)
  const pan = useRef<{ pointer: number; x: number; y: number; view: GridView } | null>(null)
  const panned = useRef(false)
  const heldSpace = useRef(false)

  function frameKey(shown: GridView) {
    const { layout: laid, room: size } = latest.current
    return `${gridZoomPlacement(laid, shown.scale)}:${gridShown(laid, shown, size, gridPaintMargin).join(",")}`
  }

  function paint(shown: GridView, refresh: boolean) {
    const node = sheet.current
    if (node !== null) paintWorld(node, shown, refresh)
    writePercent(Math.round(shown.scale * 100))
  }

  function stopGlide() {
    gliding.current = false
    if (restTimer.current !== undefined) clearTimeout(restTimer.current)
    restTimer.current = undefined
  }

  function show(next: GridCamera) {
    stopGlide()
    const shown = next === "fit" ? fittedGrid(latest.current.layout, latest.current.room) : next
    latest.current = { ...latest.current, camera: next, view: shown }
    paint(shown, false)
    if (!sameCamera(rendered.current, next)) setCamera(next)
    setSettled((held) => held + 1)
  }

  function rest() {
    if (restTimer.current !== undefined) clearTimeout(restTimer.current)
    restTimer.current = undefined
    if (!gliding.current) return
    gliding.current = false
    const next = latest.current.camera
    if (!sameCamera(rendered.current, next)) setCamera(next)
    setSettled((held) => held + 1)
  }

  function scheduleRest() {
    if (restTimer.current !== undefined) clearTimeout(restTimer.current)
    restTimer.current = setTimeout(rest, settleAfter)
  }

  function glide(next: GridView) {
    latest.current = { ...latest.current, camera: next, view: next }
    paint(next, renderedScale.current !== next.scale)
    gliding.current = true
    const key = frameKey(next)
    if (key !== paintedKey.current) {
      paintedKey.current = key
      setFrame((held) => held + 1)
    }
    scheduleRest()
  }

  useLayoutEffect(() => {
    const shown = gliding.current ? latest.current.view : view
    latest.current = gliding.current
      ? { ...latest.current, layout, ringed, elements, room, hand, onHand }
      : { camera, view, layout, ringed, elements, room, hand, onHand }
    rendered.current = camera
    paint(shown, !gliding.current)
    if (!gliding.current) renderedScale.current = shown.scale
    paintedKey.current = frameKey(shown)
  })

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
    const { layout: laid, ringed: picked, elements: frame, room: size } = latest.current
    if (frame !== null) {
      const card = laid.cards[frame.index]
      const next = card === undefined ? null : fittedGridElements(card, frame.bounds, size)
      if (next !== null) {
        show(next)
        return
      }
    }
    const next = fittedGridCards(laid, picked, size)
    if (next !== null) show(next)
  }

  const measured = room.width > 0 && room.height > 0
  useLayoutEffect(() => {
    const { camera: shown, layout: laid, room: size, ringed: picked } = latest.current
    const next = keptGridShows(shown, laid, size, picked[0])
    if (next !== shown) show(next)
  }, [layout, measured])

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
      glide(wheeledGrid(latest.current.view, event, local({ x: event.clientX, y: event.clientY })))
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
      glide(zoomedGridBy(latest.current.view, factor, at === null ? center() : local(at)))
    }
    const end = (raw: Event) => {
      raw.preventDefault()
      pinching = null
      rest()
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
      if (restTimer.current !== undefined) clearTimeout(restTimer.current)
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
    panned.current = false
    const touch = event.pointerType === "touch" && blankCanvas(event.target)
    if (event.button !== 1 && !(event.button === 0 && (latest.current.hand || heldSpace.current || touch))) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.panning = "true"
    panned.current = event.button === 0 && !touch
    pan.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, view: latest.current.view }
  }

  function follow(event: PointerEvent<HTMLDivElement>) {
    const held = pan.current
    if (held === null || held.pointer !== event.pointerId) return
    panned.current = true
    glide(pannedGrid(held.view, { x: event.clientX - held.x, y: event.clientY - held.y }))
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.pointer !== event.pointerId) return
    pan.current = null
    delete event.currentTarget.dataset.panning
    rest()
  }

  return {
    view,
    fit: camera === "fit",
    settled,
    gliding,
    viewNow: () => latest.current.view,
    room,
    space,
    reveal,
    zoomTo,
    zoomSelection,
    panBy: (delta: { readonly x: number; readonly y: number }) => show(pannedGrid(latest.current.view, delta)),
    hold: () => {
      if (latest.current.camera === "fit") show(latest.current.view)
    },
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
