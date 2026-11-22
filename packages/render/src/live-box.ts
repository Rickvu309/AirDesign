import { memberAt } from "./box-gesture.js"
import { shownBox, type BoxRead } from "./element-view.js"
import type { PaintBox } from "./paint-box.js"
import type { CanvasElement } from "./record.js"
import type { PaintStore } from "./store.js"

export function liveBox(store: PaintStore, element: CanvasElement, read: BoxRead = shownBox): PaintBox | null {
  if (element.id === null) return element.box
  const group = element.group
  const carried = group === undefined ? null : read(store, group.id)
  const nested = (element.nestedIn ?? []).map((holder) => read(store, holder.id))
  const laid = read === shownBox ? store.getLaid(element.id) : null
  return memberAt(element, read(store, element.id), store.getRotation(element.id), carried, nested, laid)
}
