import type { ElementId, StackMove } from "@airdesign/document"
import type { KeyboardEvent } from "react"
import type { GestureId } from "./gestures.js"
import type { CanvasElement } from "./record.js"

export type Grouping = {
  readonly onFrame?: (ids: readonly ElementId[]) => void
  readonly onPlainFrame?: (ids: readonly ElementId[]) => void
  readonly onGroup?: (ids: readonly ElementId[]) => void
  readonly onUngroup?: (id: ElementId) => void
}

export function handleArrangeKey(
  event: KeyboardEvent<HTMLElement>,
  gesture: GestureId | null,
  element: CanvasElement,
  id: ElementId,
  ids: readonly ElementId[],
  grouping?: Grouping,
  onOrder?: (id: ElementId, move: StackMove) => void,
): boolean {
  if (gesture === "frame") {
    if (ids.length > 0 && grouping?.onPlainFrame !== undefined) {
      event.preventDefault()
      grouping.onPlainFrame(ids)
    }
    return true
  }
  if (gesture === "group" || gesture === "ungroup") {
    if (gesture === "group" && ids.length >= 2 && grouping?.onGroup !== undefined) {
      event.preventDefault()
      grouping.onGroup(ids)
    }
    if (gesture === "ungroup" && element.kind === "group" && grouping?.onUngroup !== undefined) {
      event.preventDefault()
      grouping.onUngroup(id)
    }
    return true
  }
  if (gesture === "front" || gesture === "forward" || gesture === "backward" || gesture === "back") {
    if (onOrder !== undefined) {
      event.preventDefault()
      onOrder(id, gesture)
    }
    return true
  }
  return false
}
