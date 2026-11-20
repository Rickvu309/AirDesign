import type { ElementId } from "@airdesign/document"
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react"
import {
  cropOf,
  cropStart,
  draggedCrop,
  localStep,
  placedFrame,
  type Area,
  type CropDraft,
  type CropGrip,
  type CropSides,
} from "./crop-drag.js"
import { ownBox } from "./box-gesture.js"
import type { CanvasCrop } from "./element-paint.js"
import { useBox, useRotation } from "./element-view.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

export type Cropped = { readonly frame: Area; readonly crop: CropSides }

const handleLength = 12
const handleWidth = 4

const sideGrips = ["n", "e", "s", "w"] as const
const cornerGrips = ["nw", "ne", "se", "sw"] as const

const gripCursor: Readonly<Record<Exclude<CropGrip, "move">, string>> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
}

const handle: CSSProperties = {
  position: "absolute",
  pointerEvents: "auto",
  touchAction: "none",
  background: "var(--background)",
  boxShadow: "0 0 0 1px var(--ring)",
}

function sideHandle(grip: (typeof sideGrips)[number]): CSSProperties {
  const across = grip === "n" || grip === "s"
  return {
    ...handle,
    width: across ? handleLength * 2 : handleWidth,
    height: across ? handleWidth : handleLength * 2,
    left: grip === "w" ? 0 : grip === "e" ? "100%" : "50%",
    top: grip === "n" ? 0 : grip === "s" ? "100%" : "50%",
    transform: "translate(-50%, -50%)",
  }
}

function cornerHandle(grip: (typeof cornerGrips)[number]): readonly CSSProperties[] {
  const left = grip.includes("w")
  const top = grip.includes("n")
  const corner = {
    ...handle,
    left: left ? -handleWidth / 2 : undefined,
    right: left ? undefined : -handleWidth / 2,
    top: top ? -handleWidth / 2 : undefined,
    bottom: top ? undefined : -handleWidth / 2,
  }
  return [
    { ...corner, width: handleLength, height: handleWidth },
    { ...corner, width: handleWidth, height: handleLength },
  ]
}

function sameDraft(left: CropDraft, right: CropDraft): boolean {
  return JSON.stringify(cropOf(left)) === JSON.stringify(cropOf(right)) && sameArea(left.frame, right.frame)
}

function sameArea(left: Area, right: Area): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

function turnOf(box: PaintBox): string | undefined {
  const turns: string[] = []
  if (box.rotation !== 0) turns.push(`rotate(${box.rotation}deg)`)
  if (box.flipH || box.flipV) turns.push(`scale(${box.flipH ? -1 : 1}, ${box.flipV ? -1 : 1})`)
  return turns.length === 0 ? undefined : turns.join(" ")
}

function useHiddenLayer(host: { readonly current: HTMLElement | null }, key: string) {
  useLayoutEffect(() => {
    const layer = host.current
      ?.closest("[data-slide-paint]")
      ?.querySelector<HTMLElement>(`[data-canvas-element="${CSS.escape(key)}"]`)
    if (layer === null || layer === undefined) return
    const held = layer.style.opacity
    layer.style.opacity = "0"
    return () => {
      layer.style.opacity = held
    }
  }, [host, key])
}

export function CropFrame(props: {
  readonly id: ElementId
  readonly layer: string
  readonly box: PaintBox
  readonly crop: CanvasCrop
  readonly scaled: Scaled
  readonly unit: number
  readonly onDone: (id: ElementId, cropped: Cropped | null) => void
}) {
  const { box, crop, scaled, unit, id, onDone } = props
  const [start] = useState(() => cropStart(box.width, box.height, crop.image))
  const [draft, setDraft] = useState(start)
  const latest = useRef(draft)
  latest.current = draft
  const host = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  useHiddenLayer(host, props.layer)

  function finish() {
    if (done.current) return
    done.current = true
    const now = latest.current
    onDone(id, sameDraft(now, start) ? null : { frame: placedFrame(box, now.frame), crop: cropOf(now) })
  }

  const finishing = useRef(finish)
  finishing.current = finish

  useLayoutEffect(() => {
    host.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const surface = host.current
    if (surface === null) return
    const page = surface.ownerDocument
    function outside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && surface?.contains(event.target)) return
      finishing.current()
    }
    page.addEventListener("pointerdown", outside, true)
    return () => page.removeEventListener("pointerdown", outside, true)
  }, [])

  function press(event: PointerEvent<HTMLElement>, grip: CropGrip) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const pointer = event.pointerId
    const from = latest.current
    const pressed = { x: event.clientX, y: event.clientY }
    const page = event.currentTarget.ownerDocument
    function move(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointer) return
      const step = localStep(box, (next.clientX - pressed.x) * unit, (next.clientY - pressed.y) * unit)
      setDraft(draggedCrop(from, grip, step.x, step.y))
    }
    function stop(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointer) return
      page.removeEventListener("pointermove", move)
      page.removeEventListener("pointerup", stop)
      page.removeEventListener("pointercancel", stop)
    }
    page.addEventListener("pointermove", move)
    page.addEventListener("pointerup", stop)
    page.addEventListener("pointercancel", stop)
  }

  const { frame, image } = draft
  const picture = `url(${JSON.stringify(crop.url)}) 0 0 / 100% 100% no-repeat`
  const transform = turnOf(box)
  return (
    <div
      ref={host}
      role="group"
      aria-label="Crop"
      tabIndex={-1}
      data-crop-frame={id}
      data-keeps-selection=""
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== "Escape") return
        event.preventDefault()
        event.stopPropagation()
        finish()
      }}
      style={{
        position: "absolute",
        left: scaled(box.x),
        top: scaled(box.y),
        width: scaled(box.width),
        height: scaled(box.height),
        zIndex: 8,
        outline: "none",
        ...(transform === undefined ? {} : { transform }),
      }}
    >
      <div
        data-crop-image=""
        onPointerDown={(event) => press(event, "move")}
        style={{
          position: "absolute",
          left: scaled(image.x),
          top: scaled(image.y),
          width: scaled(image.width),
          height: scaled(image.height),
          background: picture,
          opacity: 0.5,
          cursor: "move",
          touchAction: "none",
        }}
      />
      <div
        data-crop-window=""
        onPointerDown={(event) => press(event, "move")}
        style={{
          position: "absolute",
          left: scaled(frame.x),
          top: scaled(frame.y),
          width: scaled(frame.width),
          height: scaled(frame.height),
          boxShadow: "0 0 0 1px var(--ring)",
          cursor: "move",
          touchAction: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: scaled(image.x - frame.x),
              top: scaled(image.y - frame.y),
              width: scaled(image.width),
              height: scaled(image.height),
              background: picture,
            }}
          />
        </div>
        {sideGrips.map((grip) => (
          <span
            key={grip}
            aria-hidden
            data-crop-grip={grip}
            style={{ ...sideHandle(grip), cursor: gripCursor[grip] }}
            onPointerDown={(event) => press(event, grip)}
          />
        ))}
        {cornerGrips.map((grip) =>
          cornerHandle(grip).map((style, part) => (
            <span
              key={`${grip}-${String(part)}`}
              aria-hidden
              data-crop-grip={grip}
              style={{ ...style, cursor: gripCursor[grip] }}
              onPointerDown={(event) => press(event, grip)}
            />
          )),
        )}
      </div>
    </div>
  )
}

export function cropFits(element: CanvasElement): element is CanvasElement & { readonly crop: CanvasCrop } {
  return (
    element.crop !== undefined &&
    element.id !== null &&
    element.group === undefined &&
    element.movable === true &&
    element.locked !== true
  )
}

export function CropLayer(props: {
  readonly store: PaintStore
  readonly element: CanvasElement & { readonly crop: CanvasCrop }
  readonly id: ElementId
  readonly scaled: Scaled
  readonly unit: number
  readonly onDone: (id: ElementId, cropped: Cropped | null) => void
}) {
  const { store, element, id } = props
  const box = ownBox(element, useBox(store, id), useRotation(store, id))
  if (box === null) return null
  return (
    <CropFrame
      id={id}
      layer={element.key}
      box={box}
      crop={element.crop}
      scaled={props.scaled}
      unit={props.unit}
      onDone={props.onDone}
    />
  )
}
