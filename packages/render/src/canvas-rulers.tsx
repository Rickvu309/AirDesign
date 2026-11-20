import type { ElementId, Guide } from "@airdesign/document"
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react"
import { snapTargets } from "./drag-snap.js"
import { gestureFor } from "./gestures.js"
import { guideAt, guideDrop, snappedGuide, type GuideEdit } from "./guide-edit.js"
import type { CanvasSlide } from "./record.js"
import { RulerBand, crisp, rulerSize, type Mark } from "./ruler-band.js"
import { useSelectionBounds, useSlidePlace, type Place } from "./ruler-place.js"
import { rulerTicks } from "./ruler-scale.js"
import { snapReach, type Axis } from "./snapping.js"
import type { PaintStore } from "./store.js"

const emuPerPoint = 12_700
const noGuides: readonly Guide[] = []

type Held = {
  readonly pointer: number
  readonly from: number | null
  readonly axis: Axis
  readonly duplicate: boolean
  readonly start: number
}

type Preview = {
  readonly from: number | null
  readonly axis: Axis
  readonly offset: number
  readonly duplicate: boolean
}

export type RulerProps = {
  readonly slide: CanvasSlide
  readonly store: PaintStore
  readonly selected: readonly ElementId[]
  readonly onGuides?: (edit: GuideEdit) => void
}

function pointsOf(emu: number): string {
  return String(Math.round((emu / emuPerPoint) * 10) / 10)
}

const overlay: CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }

function lineAt(guide: Guide, place: Place): number {
  return (guide.axis === "x" ? place.left : place.top) + guide.offset * place.pixelsPerEmu
}

export function CanvasRulers(props: RulerProps) {
  const { slide, store, selected, onGuides } = props
  const host = useRef<HTMLDivElement>(null)
  const place = useSlidePlace(host, slide)
  const bounds = useSelectionBounds(slide, store, selected)
  const given = slide.guides ?? noGuides
  const [pending, setPending] = useState<{ readonly given: readonly Guide[]; readonly shown: readonly Guide[] } | null>(
    null,
  )
  const guides = pending !== null && pending.given === given ? pending.shown : given
  const [chosen, setChosen] = useState<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const held = useRef<Held | null>(null)
  const chosenGuide = chosen === null ? undefined : guides[chosen]

  useEffect(() => {
    if (chosen === null || onGuides === undefined) return
    function listen(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return
      const gesture = gestureFor(event, "guide")
      if (gesture !== "delete" && gesture !== "deselect") return
      event.preventDefault()
      event.stopPropagation()
      if (gesture === "delete" && chosen !== null) {
        const edit = guideDrop(guides, { from: chosen, axis: "x", offset: 0, away: true })
        if (edit !== null) commit(edit, null)
      }
      setChosen(null)
    }
    function away(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest("[data-guide-handle]") !== null) return
      setChosen(null)
    }
    window.addEventListener("keydown", listen, { capture: true })
    window.addEventListener("pointerdown", away, { capture: true })
    return () => {
      window.removeEventListener("keydown", listen, { capture: true })
      window.removeEventListener("pointerdown", away, { capture: true })
    }
  })

  function commit(edit: GuideEdit, next: number | null) {
    setPending({ given, shown: edit.guides })
    setChosen(next)
    onGuides?.(edit)
  }

  function offsetAt(event: ReactPointerEvent<HTMLElement>, axis: Axis): { offset: number; away: boolean } | null {
    const element = host.current
    if (place === null || element === null) return null
    const frame = element.getBoundingClientRect()
    const along = axis === "x" ? event.clientX - frame.left : event.clientY - frame.top
    const raw = guideAt(along, axis === "x" ? place.left : place.top, place.pixelsPerEmu)
    const reach = snapReach / place.pixelsPerEmu
    const offset = event.ctrlKey
      ? raw
      : snappedGuide(axis, raw, snapTargets({ ...slide, guides: [] }, store, []), reach)
    const extent = axis === "x" ? slide.width : slide.height
    return { offset, away: along < rulerSize || offset < 0 || offset > extent }
  }

  function begin(event: ReactPointerEvent<HTMLDivElement>, from: number | null, axis: Axis) {
    if (event.button !== 0 || onGuides === undefined) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const duplicate = from !== null && event.altKey
    held.current = {
      pointer: event.pointerId,
      from,
      axis,
      duplicate,
      start: axis === "x" ? event.clientX : event.clientY,
    }
    if (from !== null) setChosen(from)
    if (from === null) {
      const at = offsetAt(event, axis)
      if (at !== null) setPreview({ from, axis, offset: at.offset, duplicate })
    }
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    const hold = held.current
    if (hold === null || hold.pointer !== event.pointerId) return
    const at = offsetAt(event, hold.axis)
    if (at === null) return
    const travelled = Math.abs((hold.axis === "x" ? event.clientX : event.clientY) - hold.start)
    if (hold.from !== null && travelled < 2 && preview === null) return
    setPreview({ from: hold.from, axis: hold.axis, offset: at.offset, duplicate: hold.duplicate })
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const hold = held.current
    if (hold === null || hold.pointer !== event.pointerId) return
    held.current = null
    const shown = preview
    setPreview(null)
    if (shown === null || event.type !== "pointerup") return
    const at = offsetAt(event, hold.axis)
    if (at === null) return
    const from = hold.duplicate ? null : hold.from
    const edit = guideDrop(guides, { from, axis: hold.axis, offset: at.offset, away: at.away })
    if (edit === null) return
    commit(edit, edit.name === "delete-guide" ? null : (from ?? edit.guides.length - 1))
  }

  const drawn = guides.flatMap((guide, index) =>
    preview !== null && preview.from === index && !preview.duplicate ? [] : [{ guide, index }],
  )
  const moving = preview === null ? null : { axis: preview.axis, offset: preview.offset }
  const valueMarks = (axis: Axis): readonly Mark[] => {
    if (place === null) return []
    const shown = moving ?? chosenGuide
    if (shown === undefined || shown === null || shown.axis !== axis) return []
    return [{ at: lineAt(shown, place), label: pointsOf(shown.offset), paint: "var(--ruler-guide)", chip: true }]
  }
  const bandOf = (axis: Axis): readonly [number, number] | null => {
    if (place === null || bounds === null) return null
    const origin = axis === "x" ? place.left : place.top
    const [start, end] = axis === "x" ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom]
    return [origin + start * place.pixelsPerEmu, origin + end * place.pixelsPerEmu]
  }
  const bandMarks = (axis: Axis): readonly Mark[] => {
    if (bounds === null || place === null) return []
    const band = bandOf(axis)
    if (band === null) return []
    const [start, end] = axis === "x" ? [bounds.left, bounds.right] : [bounds.top, bounds.bottom]
    return [
      { at: band[0], label: pointsOf(start), paint: "var(--ruler-selection-text)" },
      { at: band[1], label: pointsOf(end), paint: "var(--ruler-selection-text)" },
    ]
  }
  const pixelsPerPoint = place === null ? 0 : place.pixelsPerEmu * emuPerPoint
  const editable = onGuides === undefined ? {} : { onPointerMove: move, onPointerUp: end }
  return (
    <div ref={host} data-canvas-rulers="" aria-hidden="true" style={overlay}>
      {place === null ? null : (
        <>
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            {[...drawn, ...(moving === null ? [] : [{ guide: moving, index: -1 }])].map(({ guide, index }) => {
              const at = crisp(lineAt(guide, place))
              const picked = index === -1 || index === chosen
              return (
                <path
                  key={index === -1 ? "moving" : `${guide.axis} ${String(guide.offset)} ${String(index)}`}
                  data-guide-line={`${guide.axis} ${pointsOf(guide.offset)}`}
                  d={
                    guide.axis === "x"
                      ? `M${String(at)},${String(place.top)}V${String(place.top + slide.height * place.pixelsPerEmu)}`
                      : `M${String(place.left)},${String(at)}H${String(place.left + slide.width * place.pixelsPerEmu)}`
                  }
                  stroke="var(--ruler-guide)"
                  strokeWidth={picked ? 2 : 1}
                  shapeRendering="crispEdges"
                  fill="none"
                />
              )
            })}
          </svg>
          {onGuides === undefined
            ? null
            : guides.map((guide, index) => {
                const at = lineAt(guide, place)
                return (
                  <div
                    key={`${guide.axis} ${String(guide.offset)} ${String(index)}`}
                    data-guide-handle={`${guide.axis} ${pointsOf(guide.offset)}`}
                    onPointerDown={(event) => begin(event, index, guide.axis)}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    onLostPointerCapture={end}
                    style={{
                      position: "absolute",
                      pointerEvents: "auto",
                      touchAction: "none",
                      cursor: guide.axis === "x" ? "col-resize" : "row-resize",
                      ...(guide.axis === "x"
                        ? {
                            top: place.top,
                            height: slide.height * place.pixelsPerEmu,
                            left: `calc(${String(at)}px - var(--ruler-guide-reach) / 2)`,
                            width: "var(--ruler-guide-reach)",
                          }
                        : {
                            left: place.left,
                            width: slide.width * place.pixelsPerEmu,
                            top: `calc(${String(at)}px - var(--ruler-guide-reach) / 2)`,
                            height: "var(--ruler-guide-reach)",
                          }),
                    }}
                  />
                )
              })}
          <RulerBand
            axis="x"
            length={place.width}
            ticks={rulerTicks({ length: place.width, origin: place.left, pixelsPerPoint }).filter(
              (tick) => tick.at >= rulerSize,
            )}
            band={bandOf("x")}
            marks={[...bandMarks("x"), ...valueMarks("x")]}
            {...(onGuides === undefined ? {} : { onPointerDown: (event) => begin(event, null, "y"), ...editable })}
          />
          <RulerBand
            axis="y"
            length={place.height}
            ticks={rulerTicks({ length: place.height, origin: place.top, pixelsPerPoint }).filter(
              (tick) => tick.at >= rulerSize,
            )}
            band={bandOf("y")}
            marks={[...bandMarks("y"), ...valueMarks("y")]}
            {...(onGuides === undefined ? {} : { onPointerDown: (event) => begin(event, null, "x"), ...editable })}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: rulerSize,
              height: rulerSize,
              background: "var(--ruler-surface)",
              boxShadow: "inset -1px -1px 0 var(--ruler-edge)",
              pointerEvents: "auto",
            }}
          />
        </>
      )}
    </div>
  )
}
