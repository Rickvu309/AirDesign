import type { Bound, ElementId, Spot } from "@airdesign/document"
import { useState, type CSSProperties, type PointerEvent } from "react"
import { paintedAt } from "./box-gesture.js"
import { aimAt, endsOf, type Aim, type End } from "./connector-drag.js"
import { useBox } from "./element-view.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

const reachPixels = 12
const ends: readonly End[] = ["start", "end"]

type Aiming = { readonly end: End; readonly from: Spot; readonly at: Spot; readonly aim: Aim | null }

type Client = { readonly clientX: number; readonly clientY: number }

const dot: CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  borderRadius: "50%",
  boxShadow: "inset 0 0 0 2px var(--primary)",
}

const grip: CSSProperties = {
  ...dot,
  width: "var(--space-12)",
  height: "var(--space-12)",
  background: "white",
  cursor: "crosshair",
  pointerEvents: "auto",
  touchAction: "none",
}

export function ConnectorEnds(props: {
  readonly store: PaintStore
  readonly slide: CanvasSlide
  readonly element: CanvasElement
  readonly id: ElementId
  readonly scaled: Scaled
  readonly width: number
  readonly onConnect: (id: ElementId, end: End, bound: Bound) => void
}) {
  const { store, slide, element, id, scaled, width, onConnect } = props
  const box = paintedAt(element.box, useBox(store, id))
  const [aiming, setAiming] = useState<Aiming | null>(null)
  if (box === null) return null
  const spots = endsOf(box)
  const reach = (reachPixels * slide.width) / width
  const placed = (each: CanvasElement) => (each.id === null ? each.box : paintedAt(each.box, store.getBox(each.id)))

  function press(event: PointerEvent<HTMLElement>, end: End) {
    const surface = event.currentTarget.closest<HTMLElement>("[data-slide-paint]")
    if (event.button !== 0 || surface === null) return
    event.preventDefault()
    event.stopPropagation()
    const pointer = event.pointerId
    const from = end === "start" ? spots.end : spots.start
    const aimed = (client: Client): Aiming => {
      const frame = surface.getBoundingClientRect()
      const at = {
        x: ((client.clientX - frame.left) * slide.width) / width,
        y: ((client.clientY - frame.top) * slide.width) / width,
      }
      return { end, from, at, aim: aimAt(slide.elements, element, at, reach, placed) }
    }
    const document = surface.ownerDocument
    function move(next: globalThis.PointerEvent) {
      if (next.pointerId === pointer) setAiming(aimed(next))
    }
    function stop() {
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", up)
      document.removeEventListener("pointercancel", lost)
      setAiming(null)
    }
    function up(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointer) return
      const { aim } = aimed(next)
      stop()
      if (aim !== null && aim.site !== null) onConnect(id, end, { node: aim.node, site: aim.site })
    }
    function lost(next: globalThis.PointerEvent) {
      if (next.pointerId === pointer) stop()
    }
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", up)
    document.addEventListener("pointercancel", lost)
    setAiming(aimed(event))
  }

  const aim = aiming?.aim ?? null
  const goal = aim?.site === null || aim?.site === undefined ? aiming?.at : aim.sites[aim.site]
  return (
    <>
      {aiming === null || goal === undefined ? null : (
        <svg
          aria-hidden
          data-connector-aim
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <line
            x1={scaled(aiming.from.x)}
            y1={scaled(aiming.from.y)}
            x2={scaled(goal.x)}
            y2={scaled(goal.y)}
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        </svg>
      )}
      {aim?.sites.map((spot, site) => {
        const chosen = site === aim.site
        return (
          <span
            key={site}
            aria-hidden
            data-connector-site={site}
            data-connector-target={aim.node}
            {...(chosen ? { "data-connector-chosen": true } : {})}
            style={{
              ...dot,
              left: scaled(spot.x),
              top: scaled(spot.y),
              width: chosen ? "var(--space-12)" : "var(--space-8)",
              height: chosen ? "var(--space-12)" : "var(--space-8)",
              background: chosen ? "var(--primary)" : "white",
              pointerEvents: "none",
            }}
          />
        )
      })}
      {ends
        .filter((end) => end !== aiming?.end)
        .map((end) => (
          <span
            key={end}
            aria-hidden
            data-connector-end={end}
            style={{ ...grip, left: scaled(spots[end].x), top: scaled(spots[end].y) }}
            onPointerDown={(event) => press(event, end)}
          />
        ))}
    </>
  )
}
