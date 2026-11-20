import { route, type Bound, type ElementId, type Place, type Spot } from "@airdesign/document"
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import { emuOf, ownBox, travelled, type Point } from "./box-gesture.js"
import { aimAt, endsOf, paintPlace, type Aim, type End } from "./connector-drag.js"
import { snapConnectorEnd, type EndModifiers } from "./connector-snap.js"
import { snapTargets } from "./drag-snap.js"
import type { GuideBoard } from "./guide-layer.js"
import { liveBox } from "./live-box.js"
import { useBox } from "./element-view.js"
import { oncePerFrame } from "./once-per-frame.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import { reachOf, type Guide } from "./snapping.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

const reachPixels = 12
const ends: readonly End[] = ["start", "end"]

type Aiming = { readonly end: End; readonly from: Spot; readonly at: Spot; readonly aim: Aim | null }

type ResolvedEnd = Aiming & { readonly guides: readonly Guide[] }

export type EndDrop = Bound | Place

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
  readonly guides?: GuideBoard
  readonly onConnect: (id: ElementId, end: End, to: EndDrop) => void
}) {
  const { store, slide, element, id, scaled, width, guides, onConnect } = props
  const box = ownBox(element, useBox(store, id))
  const [aiming, setAiming] = useState<Aiming | null>(null)
  const cancelling = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelling.current?.(), [])
  if (box === null) return null
  const spots = endsOf(box)
  const reach = (reachPixels * slide.width) / width
  const placed = (each: CanvasElement) => liveBox(store, each)

  function press(event: PointerEvent<HTMLElement>, end: End) {
    const surface = event.currentTarget.closest<HTMLElement>("[data-slide-paint]")
    if (event.button !== 0 || surface === null) return
    event.preventDefault()
    event.stopPropagation()
    cancelling.current?.()
    guides?.show([])
    const pointer = event.pointerId
    const pressed: Point = { x: event.clientX, y: event.clientY }
    const from = end === "start" ? spots.end : spots.start
    const targets = snapTargets(slide, store, [id])
    const snapReachEmu = reachOf(width, slide.width)
    let lastPoint = pressed
    let lastModifiers: EndModifiers = { shiftKey: event.shiftKey, ctrlKey: event.ctrlKey }
    let moved = false

    const resolve = (point: Point, modifiers: EndModifiers, active: boolean): ResolvedEnd => {
      const frame = surface.getBoundingClientRect()
      const raw: Spot = {
        x: emuOf(point.x - frame.left, width, slide),
        y: emuOf(point.y - frame.top, width, slide),
      }
      if (!active) return { end, from, at: raw, aim: null, guides: [] }
      const aim = modifiers.ctrlKey || modifiers.shiftKey ? null : aimAt(slide.elements, element, raw, reach, placed)
      if (aim !== null && aim.site !== null) {
        const spot = aim.sites[aim.site]
        return { end, from, at: spot ?? raw, aim, guides: [] }
      }
      const snapped = snapConnectorEnd(from, raw, targets, snapReachEmu, modifiers)
      return { end, from, at: snapped.at, aim, guides: snapped.guides }
    }

    const apply = (point: Point, modifiers: EndModifiers) => {
      const next = resolve(point, modifiers, moved)
      setAiming({ end: next.end, from: next.from, at: next.at, aim: next.aim })
      guides?.show(next.guides)
    }

    const painting = oncePerFrame(
      ({ point, modifiers }: { readonly point: Point; readonly modifiers: EndModifiers }) => {
        apply(point, modifiers)
      },
    )

    const document = surface.ownerDocument

    function stop() {
      painting.drop()
      document.removeEventListener("pointermove", move)
      document.removeEventListener("pointerup", up)
      document.removeEventListener("pointercancel", lost)
      document.removeEventListener("keydown", keyed)
      document.removeEventListener("keyup", keyed)
      cancelling.current = null
      guides?.show([])
      setAiming(null)
    }

    function move(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointer) return
      lastPoint = { x: next.clientX, y: next.clientY }
      lastModifiers = { shiftKey: next.shiftKey, ctrlKey: next.ctrlKey }
      if (!moved && travelled(pressed, lastPoint)) moved = true
      painting.push({ point: lastPoint, modifiers: lastModifiers })
    }

    function keyed(next: globalThis.KeyboardEvent) {
      if (next.key !== "Shift" && next.key !== "Control") return
      lastModifiers = { shiftKey: next.shiftKey, ctrlKey: next.ctrlKey }
      if (!moved) return
      painting.drop()
      apply(lastPoint, lastModifiers)
    }

    function up(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointer) return
      const upPoint: Point = { x: next.clientX, y: next.clientY }
      const upModifiers: EndModifiers = { shiftKey: next.shiftKey, ctrlKey: next.ctrlKey }
      const dragged = moved || travelled(pressed, upPoint)
      const resolved = resolve(upPoint, upModifiers, dragged)
      stop()
      if (!dragged) return
      if (resolved.aim !== null && resolved.aim.site !== null)
        onConnect(id, end, { node: resolved.aim.node, site: resolved.aim.site })
      else if (box !== null)
        onConnect(
          id,
          end,
          end === "start" ? route(paintPlace(box), resolved.at, from) : route(paintPlace(box), from, resolved.at),
        )
    }

    function lost(next: globalThis.PointerEvent) {
      if (next.pointerId === pointer) stop()
    }

    cancelling.current = stop
    document.addEventListener("pointermove", move)
    document.addEventListener("pointerup", up)
    document.addEventListener("pointercancel", lost)
    document.addEventListener("keydown", keyed)
    document.addEventListener("keyup", keyed)
    setAiming({ end, from, at: spots[end], aim: null })
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
