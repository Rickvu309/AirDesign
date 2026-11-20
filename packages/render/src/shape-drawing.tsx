import type { Spot } from "@airdesign/document"
import { useEffect, useRef, useState, type PointerEvent } from "react"
import { dragThreshold } from "./box-gesture.js"
import { snapTargets } from "./drag-snap.js"
import type { GuideBoard } from "./guide-layer.js"
import type { CanvasSlide } from "./record.js"
import { drawnShape, type DrawKeys, type DrawnBox, type ShapeKind } from "./shape-draw.js"
import { reachOf, type SnapTargets } from "./snapping.js"
import type { PaintStore } from "./store.js"

export type ShapeLook = ShapeKind | "ellipse"

export type ShapeDrawn = { readonly at: Spot } | { readonly box: DrawnBox }

export type ShapeDrawing = { readonly look: ShapeLook; readonly onDraw: (drawn: ShapeDrawn) => void }

type Drawing = {
  readonly pointer: number
  readonly from: Spot
  readonly to: Spot
  readonly shown: number
  readonly keys: DrawKeys
  readonly targets: SnapTargets
}

function keysOf(event: { readonly shiftKey: boolean; readonly altKey: boolean; readonly ctrlKey: boolean }): DrawKeys {
  return { shift: event.shiftKey, alt: event.altKey, free: event.ctrlKey }
}

function spanned(drawing: Drawing): boolean {
  return Math.hypot(drawing.to.x - drawing.from.x, drawing.to.y - drawing.from.y) >= dragThreshold
}

function emuOf(drawing: Drawing, slideWidth: number, spot: Spot): Spot {
  return {
    x: Math.round((spot.x * slideWidth) / drawing.shown),
    y: Math.round((spot.y * slideWidth) / drawing.shown),
  }
}

export function drawnOf(drawing: Drawing, slideWidth: number, kind: ShapeKind) {
  const from = emuOf(drawing, slideWidth, drawing.from)
  if (!spanned(drawing)) return { drawn: { at: from }, guides: [] } as const
  const to = emuOf(drawing, slideWidth, drawing.to)
  const reach = reachOf(drawing.shown, slideWidth)
  const shape = drawnShape(kind, from, to, drawing.keys, drawing.targets, reach)
  return { drawn: { box: shape.box }, guides: shape.guides } as const
}

function Preview({ look, box, scaled }: { look: ShapeLook; box: DrawnBox; scaled: (emu: number) => number }) {
  const place = { left: scaled(box.x), top: scaled(box.y), width: scaled(box.cx), height: scaled(box.cy) }
  if (look === "line") {
    const [x1, x2] = box.flipH ? [place.width, 0] : [0, place.width]
    const [y1, y2] = box.flipV ? [place.height, 0] : [0, place.height]
    return (
      <svg
        data-shape-drawn={look}
        style={{ position: "absolute", ...place, overflow: "visible", pointerEvents: "none" }}
      >
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ring)" strokeWidth={1} />
      </svg>
    )
  }
  return (
    <div
      data-shape-drawn={look}
      style={{
        position: "absolute",
        ...place,
        pointerEvents: "none",
        boxSizing: "border-box",
        border: "1px solid var(--ring)",
        borderRadius: look === "ellipse" ? "50%" : 0,
      }}
    />
  )
}

export function ShapeDrawingLayer(props: {
  readonly slide: CanvasSlide
  readonly store: PaintStore
  readonly width: number
  readonly guides: GuideBoard
  readonly drawing: ShapeDrawing
}) {
  const { slide, store, width, guides, drawing: tool } = props
  const kind: ShapeKind = tool.look === "line" ? "line" : "box"
  const [drawing, draw] = useState<Drawing | null>(null)
  const latest = useRef<Drawing | null>(null)
  function track(next: Drawing | null) {
    latest.current = next
    draw(next)
    guides.show(next === null ? [] : drawnOf(next, slide.width, kind).guides)
  }
  useEffect(() => {
    if (drawing === null) return
    function keyed(event: KeyboardEvent) {
      const now = latest.current
      if (now !== null) track({ ...now, keys: keysOf(event) })
    }
    window.addEventListener("keydown", keyed)
    window.addEventListener("keyup", keyed)
    return () => {
      window.removeEventListener("keydown", keyed)
      window.removeEventListener("keyup", keyed)
    }
  })
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
    track({ pointer: event.pointerId, from: point, to: point, shown, keys: keysOf(event), targets })
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const now = latest.current
    if (now?.pointer !== event.pointerId) return
    event.stopPropagation()
    track({ ...now, to: at(event), keys: keysOf(event) })
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    const now = latest.current
    if (now?.pointer !== event.pointerId) return
    event.stopPropagation()
    const done = { ...now, to: at(event), keys: keysOf(event) }
    track(null)
    if (done.shown > 0) tool.onDraw(drawnOf(done, slide.width, kind).drawn)
  }
  const scaled = (emu: number) => (emu * width) / slide.width
  const shown = drawing === null ? null : drawnOf(drawing, slide.width, kind).drawn
  return (
    <div
      data-shape-drawing={tool.look}
      style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "crosshair", touchAction: "none" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => track(null)}
    >
      {shown === null || !("box" in shown) ? null : <Preview look={tool.look} box={shown.box} scaled={scaled} />}
    </div>
  )
}
