import type { Box } from "./box.js"
import { currentBox, currentValue, decide, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { elementCommand, elementGone, type ElementCommand } from "./element-order.js"
import type { OrderKey } from "./order-key.js"
import { foldSlides, type SlideCommand, type SlideState } from "./slide-order.js"
import type { Value } from "./value.js"

export type SlideSpot = { readonly present: boolean; readonly key: OrderKey }

export type Undoable =
  | { readonly node: ElementId; readonly floor: string; readonly before: Value; readonly after: Value }
  | {
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: SlideSpot
      readonly after: SlideSpot
    }
  | {
      readonly element: ElementId
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: boolean
      readonly after: boolean
    }

export type Turn = { readonly ok: true; readonly command: Command } | { readonly ok: false }

const changed: Turn = { ok: false }

function spotOf(register: Register, file: readonly SlideId[], id: SlideId): SlideSpot | undefined {
  const known = register.file.length > 0 ? register.file : file
  const spot = foldSlides({ file: known, order: register.order }).find((each) => each.id === id)
  return spot === undefined ? undefined : { present: spot.present, key: spot.key }
}

function elementOf(edit: ElementCommand): ElementId {
  return edit.slide === "element-add" ? edit.element.node : edit.node
}

export function slideUndoable(register: Register, file: readonly SlideId[], edit: SlideCommand): Undoable | null {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") return null
  if (elementCommand(edit)) {
    const element = elementOf(edit)
    const shown = (state: Register) => !elementGone(state, element)
    return {
      element,
      slide: edit.id,
      file,
      before: edit.slide !== "element-add" && shown(register),
      after: shown(decision.register),
    }
  }
  const after = spotOf(decision.register, file, edit.id)
  if (after === undefined) return null
  const before = spotOf(register, file, edit.id) ?? { present: false, key: after.key }
  return { slide: edit.id, file, before, after }
}

function sameBox(left: Box | null, right: Box): boolean {
  return left !== null && left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}

function shows(register: Register, node: ElementId, value: Value): boolean {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  if (body === undefined) return false
  if (value.property === "box") return sameBox(currentBox(body), value.value)
  return currentValue(body) === value.value
}

function sits(spot: SlideSpot | undefined, wanted: SlideSpot): boolean {
  if (spot === undefined || spot.present !== wanted.present) return false
  return !wanted.present || spot.key === wanted.key
}

function slideTurn(from: SlideSpot, to: SlideSpot, id: SlideId): SlideCommand | null {
  if (from.present && !to.present) return { slide: "remove", id }
  if (!from.present && to.present) return { slide: "restore", id, key: to.key }
  if (from.present && to.present && from.key !== to.key) return { slide: "move", id, key: to.key }
  return null
}

function landing(register: Register, command: Command): Turn {
  return decide(register, command).decision === "apply" ? { ok: true, command } : changed
}

function turn(register: Register, undoable: Undoable, from: "before" | "after"): Turn {
  const to = from === "before" ? "after" : "before"
  if ("node" in undoable) {
    if (!shows(register, undoable.node, undoable[from])) return changed
    return landing(register, { command: "person", ...undoable[to], node: undoable.node })
  }
  const file = register.file.length > 0 ? register.file : undoable.file
  if ("element" in undoable) {
    const { element, slide } = undoable
    if (elementGone(register, element) === undoable[from] || undoable[from] === undoable[to]) return changed
    const edit: SlideCommand = undoable[to]
      ? { slide: "element-restore", id: slide, node: element }
      : { slide: "element-remove", id: slide, node: element }
    return landing(register, { command: "slide", file, edit })
  }
  if (!sits(spotOf(register, undoable.file, undoable.slide), undoable[from])) return changed
  const edit = slideTurn(undoable[from], undoable[to], undoable.slide)
  if (edit === null) return changed
  return landing(register, { command: "slide", file, edit })
}

export function undoOf(register: Register, undoable: Undoable): Turn {
  return turn(register, undoable, "after")
}

export function redoOf(register: Register, undoable: Undoable): Turn {
  return turn(register, undoable, "before")
}

function spotIn(state: SlideState, id: SlideId): SlideSpot | undefined {
  const spot = foldSlides(state).find((each) => each.id === id)
  return spot === undefined ? undefined : { present: spot.present, key: spot.key }
}

function personEdited(register: Register, node: ElementId): boolean {
  return register.elements[node]?.landed.some((row) => row.actor === "person" && row.visible) === true
}

function undoableAt(register: Register, at: number, edit: SlideCommand): Undoable | null {
  if (elementCommand(edit)) {
    const node = elementOf(edit)
    if (edit.slide === "element-add" && personEdited(register, node)) return null
    const before = register.order.slice(0, at)
    const upTo = register.order.slice(0, at + 1)
    return {
      element: node,
      slide: edit.id,
      file: register.file,
      before: edit.slide !== "element-add" && !elementGone({ file: register.file, order: before }, node),
      after: !elementGone({ file: register.file, order: upTo }, node),
    }
  }
  const after = spotIn({ file: register.file, order: register.order.slice(0, at + 1) }, edit.id)
  if (after === undefined) return null
  const before = spotIn({ file: register.file, order: register.order.slice(0, at) }, edit.id) ?? {
    present: false,
    key: after.key,
  }
  return { slide: edit.id, file: register.file, before, after }
}

export function undoSlides(register: Register, runId: string): Register | null {
  let current = register
  for (let at = register.order.length - 1; at >= 0; at -= 1) {
    const edit = register.order[at]
    if (edit === undefined || edit.runId !== runId) continue
    const undoable = undoableAt(register, at, edit)
    if (undoable === null) return null
    const undone = undoOf(current, undoable)
    if (!undone.ok) return null
    const decision = decide(current, undone.command)
    if (decision.decision !== "apply") return null
    current = decision.register
  }
  return current
}
