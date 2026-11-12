import type { ElementId } from "@airdesign/document"
import type { CSSProperties, PointerEvent } from "react"
import { corners, paintedAt, type Corner, type Grip } from "./box-gesture.js"
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
  "top-left": { left: 0, top: 0, cursor: "nwse-resize" },
  "top-right": { left: "100%", top: 0, cursor: "nesw-resize" },
  "bottom-left": { left: 0, top: "100%", cursor: "nesw-resize" },
  "bottom-right": { left: "100%", top: "100%", cursor: "nwse-resize" },
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
  const box = paintedAt(element.box, useBox(props.store, props.id))
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
              style={{ ...handle, ...handles[corner] }}
              onPointerDown={(event) => onPress(event, corner)}
            />
          ))
        : null}
    </div>
  )
}
