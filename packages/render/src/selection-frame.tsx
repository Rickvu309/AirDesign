import type { ElementId } from "@airdesign/document"
import type { CSSProperties, PointerEvent } from "react"
import { corners, ownBox, type Corner, type Grip } from "./box-gesture.js"
import { useBox } from "./element-view.js"
import type { CanvasElement } from "./record.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

const thick = "var(--space-8)"

const bands: readonly CSSProperties[] = [
  { left: 0, top: 0, width: "100%", height: thick, transform: "translateY(-50%)" },
  { left: "100%", top: 0, width: thick, height: "100%", transform: "translateX(-50%)" },
  { left: 0, top: "100%", width: "100%", height: thick, transform: "translateY(-50%)" },
  { left: 0, top: 0, width: thick, height: "100%", transform: "translateX(-50%)" },
]

const handles: Readonly<Record<Corner, CSSProperties>> = {
  "top-left": { left: 0, top: 0 },
  "top-right": { left: "100%", top: 0 },
  "bottom-left": { left: 0, top: "100%" },
  "bottom-right": { left: "100%", top: "100%" },
}

const pointing: Readonly<Record<Corner, number>> = {
  "bottom-right": 45,
  "bottom-left": 135,
  "top-left": 225,
  "top-right": 315,
}

const cursors = ["ew-resize", "nwse-resize", "ns-resize", "nesw-resize"] as const

function cursorOf(corner: Corner, rotation: number): string {
  const across = (((pointing[corner] + rotation) % 180) + 180) % 180
  return cursors[Math.round(across / 45) % cursors.length] ?? "move"
}

const gripped: CSSProperties = { position: "absolute", pointerEvents: "auto", touchAction: "none" }

const handle: CSSProperties = {
  ...gripped,
  width: thick,
  height: thick,
  transform: "translate(-50%, -50%)",
  background: "white",
  boxShadow: "inset 0 0 0 1px var(--primary)",
}

export function SelectionFrame(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly movable: boolean
  readonly resizable: boolean
  readonly onPress: (event: PointerEvent<HTMLElement>, grip: Grip) => void
}) {
  const { element, onPress, scaled } = props
  const box = ownBox(element, useBox(props.store, props.id))
  if (box === null) return null
  return (
    <div
      data-selection={props.id}
      aria-hidden
      style={{
        position: "absolute",
        left: scaled(box.x),
        top: scaled(box.y),
        width: scaled(box.width),
        height: scaled(box.height),
        ...(box.rotation === 0 ? {} : { transform: `rotate(${box.rotation}deg)` }),
        boxShadow: "0 0 0 2px var(--ring)",
        pointerEvents: "none",
      }}
    >
      {props.movable
        ? bands.map((band, index) => (
            <span
              key={index}
              data-grip="move"
              style={{ ...gripped, ...band, cursor: "move" }}
              onPointerDown={(event) => onPress(event, "move")}
            />
          ))
        : null}
      {props.resizable
        ? corners.map((corner) => (
            <span
              key={corner}
              data-grip={corner}
              style={{ ...handle, ...handles[corner], cursor: cursorOf(corner, box.rotation) }}
              onPointerDown={(event) => onPress(event, corner)}
            />
          ))
        : null}
    </div>
  )
}

export function ChosenFrame(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly element: CanvasElement
  readonly scaled: Scaled
}) {
  const { element, scaled } = props
  const box = ownBox(element, useBox(props.store, props.id))
  if (box === null) return null
  return (
    <div
      data-chosen={props.id}
      aria-hidden
      style={{
        position: "absolute",
        left: scaled(box.x),
        top: scaled(box.y),
        width: scaled(box.width),
        height: scaled(box.height),
        ...(box.rotation === 0 ? {} : { transform: `rotate(${box.rotation}deg)` }),
        boxShadow: "0 0 0 2px var(--ring)",
        pointerEvents: "none",
      }}
    />
  )
}
