import type { Spot } from "@airdesign/document"
import { useRef, useState, type PointerEvent } from "react"
import { dragThreshold } from "./box-gesture.js"
import { snapTargets } from "./drag-snap.js"
import type { GuideBoard } from "./guide-layer.js"
import type { CanvasSlide } from "./record.js"
import { reachOf, type Guide, type SnapTargets } from "./snapping.js"
import type { PaintStore } from "./store.js"
import { snappedTextDraw } from "./text-draw-snap.js"

export type TextPlace = { readonly x: number; readonly y: number; readonly cx?: number; readonly cy?: number }

export type TextDrawn = {
  readonly from: Spot
  readonly to: Spot
  readonly shown: number
  readonly free: boolean
}

type Drawing = TextDrawn & { readonly pointer: number; readonly targets: SnapTargets }

type Placed = { readonly place: TextPlace; readonly guides: readonly Guide[] }

function spanned(drawn: TextDrawn): boolean {
  return Math.hypot(drawn.to.x - drawn.from.x, drawn.to.y - drawn.from.y) >= dragThreshold
}

export function placedText(drawn: TextDrawn, slideWidth: number, targets: SnapTargets): Placed {
  const emu = (pixels: number) => Math.round((pixels * slideWidth) / drawn.shown)
  const from = { x: emu(drawn.from.x), y: emu(drawn.from.y) }
  if (!spanned(drawn)) return { place: from, guides: [] }
  const reach = reachOf(drawn.shown, slideWidth)
  const snapped = snappedTextDraw(from, { x: emu(drawn.to.x), y: emu(drawn.to.y) }, targets, reach, drawn.free)
  const left = Math.min(snapped.from.x, snapped.to.x)
  const top = Math.min(snapped.from.y, snapped.to.y)
  const place = {
    x: left,
    y: top,
    cx: Math.max(1, Math.max(snapped.from.x, snapped.to.x) - left),
    cy: Math.max(1, Math.max(snapped.from.y, snapped.to.y) - top),
  }
  return { place, guides: snapped.guides }
}

export function TextPlacing(props: {
  readonly slide: CanvasSlide
  readonly store: PaintStore
  readonly width: number
  readonly guides: GuideBoard
  readonly onPlace: (place: TextPlace) => void
}) {
  const { slide, store, width, guides, onPlace } = props
  const [drawing, draw] = useState<Drawing | null>(null)
  const latest = useRef<Drawing | null>(null)
  function track(next: Drawing | null) {
    latest.current = next
    draw(next)
    guides.show(next === null ? [] : placedText(next, slide.width, next.targets).guides)
  }
  function at(event: PointerEvent<HTMLDivElement>): Spot {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = at(event)
    const shown = event.currentTarget.getBoundingClientRect().width
    const targets = snapTargets(slide, store, [])
    track({ pointer: event.pointerId, from: point, to: point, shown, free: event.ctrlKey, targets })
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const now = latest.current
    if (now?.pointer !== event.pointerId) return
    event.stopPropagation()
    track({ ...now, to: at(event), free: event.ctrlKey })
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const now = latest.current
    if (now?.pointer !== event.pointerId) return
    event.stopPropagation()
    const done = { ...now, to: at(event), free: event.ctrlKey }
    track(null)
    if (done.shown > 0) onPlace(placedText(done, slide.width, done.targets).place)
  }
  const scaled = (emu: number) => (emu * width) / slide.width
  const frame = drawing === null || !spanned(drawing) ? null : placedText(drawing, slide.width, drawing.targets).place
  return (
    <div
      data-text-placing
      style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "text", touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => track(null)}
    >
      {frame === null ? null : (
        <div
          data-text-drawn
          style={{
            position: "absolute",
            pointerEvents: "none",
            boxSizing: "border-box",
            border: "1px solid var(--ring)",
            left: scaled(frame.x),
            top: scaled(frame.y),
            width: scaled(frame.cx ?? 0),
            height: scaled(frame.cy ?? 0),
          }}
        />
      )}
    </div>
  )
}
