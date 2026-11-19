import { followed, ownBox } from "./box-gesture.js"
import { shownBox, type BoxRead } from "./element-view.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import type { PaintStore } from "./store.js"

export function liveBox(store: PaintStore, element: CanvasElement, read: BoxRead = shownBox): PaintBox | null {
  if (element.id === null) return element.box
  const own = ownBox(element, read(store, element.id), store.getRotation(element.id))
  const group = element.group
  return group === undefined ? own : followed(own, group.box, read(store, group.id), group.frame === undefined)
}
