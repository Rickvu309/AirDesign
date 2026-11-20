import type { ElementId } from "@airdesign/document"
import { useMemo, useSyncExternalStore, type PointerEvent } from "react"
import { boxOf, followed, ownBox } from "./box-gesture.js"
import { useBox, useRotation } from "./element-view.js"
import { liveBox } from "./live-box.js"
import { grownTable, useRows } from "./table-rows.js"
import type { CanvasElement, PaintBox } from "./record.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"
import { TransformHandles } from "./transform-handles.js"
import { normalizeDegrees, selectionFrame, type RotatedLayer, type TransformGrip } from "./transform-math.js"

function useLiveBox(store: PaintStore, id: ElementId, element: CanvasElement): PaintBox | null {
  const group = element.group
  const carried = useBox(store, group?.id ?? id)
  const own = ownBox(element, useBox(store, id), useRotation(store, id))
  const rows = useRows(store, id)
  const box = group === undefined ? own : followed(own, group.box, carried, group.frame === undefined)
  return box === null || element.table === undefined ? box : grownTable(box, rows)
}

export function SelectionFrame(props: {
  readonly store: PaintStore
  readonly id: ElementId
  readonly element: CanvasElement
  readonly scaled: Scaled
  readonly resizable: boolean
  readonly rotatable: boolean
  readonly onPress: (event: PointerEvent<HTMLElement>, grip: TransformGrip) => void
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
        boxShadow: "0 0 0 1px var(--ring)",
        pointerEvents: "none",
      }}
    >
      <TransformHandles
        onPress={onPress}
        resizable={props.resizable}
        rotatable={props.rotatable}
        rotation={box.rotation}
      />
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
  readonly resizable: boolean
  readonly rotatable: boolean
  readonly onPress: (event: PointerEvent<HTMLElement>, grip: TransformGrip) => void
}) {
  const { elements, onPress, resizable, rotatable, scaled, store } = props
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
    const layers = new Map<ElementId, RotatedLayer>()
    for (const each of elements) {
      if (each.id === null) continue
      const box = liveBox(store, each)
      if (box !== null) layers.set(each.id, { box: boxOf(box), rotation: normalizeDegrees(box.rotation) })
    }
    const frame = selectionFrame(layers)
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
        boxShadow: "0 0 0 1px var(--ring)",
        pointerEvents: "none",
      }}
    >
      <TransformHandles onPress={onPress} resizable={resizable} rotatable={rotatable} rotation={0} />
    </div>
  )
}
