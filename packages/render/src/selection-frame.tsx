import type { ElementId } from "@airdesign/document"
import { useMemo, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react"
import { corners, followed, frameOf, ownBox, type Corner, type Grip } from "./box-gesture.js"
import { useBox } from "./element-view.js"
import { liveBox } from "./live-box.js"
import type { CanvasElement, PaintBox } from "./record.js"
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

function useLiveBox(store: PaintStore, id: ElementId, element: CanvasElement): PaintBox | null {
  const group = element.group
  const carried = useBox(store, group?.id ?? id)
  const own = ownBox(element, useBox(store, id))
  return group === undefined ? own : followed(own, group.box, carried, group.frame === undefined)
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
  const box = useLiveBox(props.store, props.id, element)
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
  const box = useLiveBox(props.store, props.id, element)
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
        boxShadow: "0 0 0 1px var(--ring)",
        pointerEvents: "none",
      }}
    />
  )
}

export function AroundFrame(props: {
  readonly store: PaintStore
  readonly elements: readonly CanvasElement[]
  readonly scaled: Scaled
  readonly onPress: (event: PointerEvent<HTMLElement>) => void
}) {
  const { elements, scaled, store } = props
  const subscribe = useMemo(
    () => (listener: () => void) => {
      const ids = new Set<ElementId>()
      for (const each of elements) {
        if (each.id !== null) ids.add(each.id)
        if (each.group !== undefined) ids.add(each.group.id)
      }
      const offs = [...ids].map((id) => store.boxSubscribe(id)(listener))
      return () => {
        for (const off of offs) off()
      }
    },
    [elements, store],
  )
  const read = () => {
    const boxes = elements.flatMap((each) => {
      const box = liveBox(store, each)
      return box === null ? [] : [{ x: box.x, y: box.y, cx: box.width, cy: box.height }]
    })
    const frame = frameOf(boxes)
    return frame === null ? "" : [frame.x, frame.y, frame.cx, frame.cy].join(" ")
  }
  const shown = useSyncExternalStore(subscribe, read, read)
  const [x = 0, y = 0, cx = 0, cy = 0] = shown.split(" ").map(Number)
  if (shown === "") return null
  return (
    <div
      data-selection-around={elements.length}
      aria-hidden
      style={{
        position: "absolute",
        left: scaled(x),
        top: scaled(y),
        width: scaled(cx),
        height: scaled(cy),
        boxShadow: "0 0 0 2px var(--ring)",
        pointerEvents: "none",
      }}
    >
      {bands.map((band, index) => (
        <span
          key={index}
          data-grip="move"
          style={{ ...gripped, ...band, cursor: "move" }}
          onPointerDown={props.onPress}
        />
      ))}
    </div>
  )
}
