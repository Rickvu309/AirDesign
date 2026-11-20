import type { Box } from "./box.js"
import type { IndexElement } from "./deck-index.js"
import { currentValue, history, landedPatch, valueHolder, type Register } from "./decide.js"
import { readSlideId, shapeOf, type ElementId } from "./element-id.js"
import { cloneRefusal, elementGone, type CloneRefusal, type ElementClone } from "./element-order.js"
import { floorOpening, openingElement } from "./slide-floor.js"

function shownRow(register: Register, source: ElementId): IndexElement | undefined {
  const row = openingElement(register, source)
  if (row === undefined) return undefined
  const body = register.nodes.includes(source) ? register.elements[source] : undefined
  const value = body !== undefined && history(body).length > 0 ? currentValue(body) : row.value
  const landed = body === undefined ? {} : landedPatch(body, valueHolder(register, source, "person"))
  const opening = floorOpening(register, source, landed)
  const { group: _group, frame: _frame, framing: _framing, opening: _opening, ...kept } = row
  return { ...kept, value, ...(opening === undefined ? {} : { opening }) }
}

export type Cloned =
  | { readonly ok: true; readonly command: ElementClone }
  | { readonly ok: false; readonly refusal: CloneRefusal }

export function cloneOf(register: Register, source: ElementId, node: ElementId, box: Box): Cloned {
  const id = readSlideId(shapeOf(source).slide)
  const row = shownRow(register, source)
  if (id === undefined || row === undefined || elementGone(register, source)) return { ok: false, refusal: "dead" }
  const command: ElementClone = { slide: "element-clone", id, source, element: { ...row, node, box, grouped: false } }
  const refusal = cloneRefusal(register, command)
  return refusal === null ? { ok: true, command } : { ok: false, refusal }
}
