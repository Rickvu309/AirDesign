import { dragThreshold } from "@airdesign/render"
import { useRef, useState, type PointerEvent } from "react"
import type { SlideSize } from "@/editor/canvas-zoom"
import type { TextPlace } from "@/element-edit"

type Point = { readonly x: number; readonly y: number }

type Drawn = { readonly pointer: number; readonly from: Point; readonly to: Point }

function spanned(drawn: Drawn): boolean {
  return Math.hypot(drawn.to.x - drawn.from.x, drawn.to.y - drawn.from.y) >= dragThreshold
}

function framed(drawn: Drawn) {
  const left = Math.min(drawn.from.x, drawn.to.x)
  const top = Math.min(drawn.from.y, drawn.to.y)
  return { left, top, width: Math.abs(drawn.to.x - drawn.from.x), height: Math.abs(drawn.to.y - drawn.from.y) }
}

export function placeOf(drawn: Drawn, slide: SlideSize, shown: number): TextPlace {
  const emu = (pixels: number) => Math.round((pixels * slide.width) / shown)
  if (!spanned(drawn)) return { x: emu(drawn.from.x), y: emu(drawn.from.y) }
  const frame = framed(drawn)
  return {
    x: emu(frame.left),
    y: emu(frame.top),
    cx: Math.max(1, emu(frame.width)),
    cy: Math.max(1, emu(frame.height)),
  }
}

export function TextPlacing({ slide, onPlace }: { slide: SlideSize; onPlace: (place: TextPlace) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [drawn, draw] = useState<Drawn | null>(null)
  function at(event: PointerEvent<HTMLDivElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = at(event)
    draw({ pointer: event.pointerId, from: point, to: point })
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (drawn?.pointer !== event.pointerId) return
    draw({ ...drawn, to: at(event) })
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (drawn?.pointer !== event.pointerId) return
    const done = { ...drawn, to: at(event) }
    draw(null)
    const shown = host.current?.getBoundingClientRect().width ?? 0
    if (shown > 0) onPlace(placeOf(done, slide, shown))
  }
  return (
    <div
      ref={host}
      data-text-placing
      className="absolute inset-0 z-10 cursor-text touch-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => draw(null)}
    >
      {drawn !== null && spanned(drawn) ? (
        <div className="pointer-events-none absolute border border-[var(--ring)]" style={framed(drawn)} />
      ) : null}
    </div>
  )
}
