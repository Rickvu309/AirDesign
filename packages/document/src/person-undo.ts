import { decide, shownPatch, valueHolder, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { elementCommand, elementGone, type ElementCommand, type ElementOrder } from "./element-order.js"
import { elementStacks, sitsBefore } from "./element-stack.js"
import type { OrderKey } from "./order-key.js"
import { sameColor, type Color } from "./color.js"
import { backgroundOf } from "./slide-background.js"
import { foldSlides, type SlideCommand, type SlideState } from "./slide-order.js"
import { formatOne, shows, type ElementPatch, type ValueHolder } from "./row.js"

const valueHolders: readonly ValueHolder[] = ["notes", "table", "text"]

export type SlideSpot = { readonly present: boolean; readonly key: OrderKey }

export type NodeStep = { readonly node: ElementId; readonly before: ElementPatch; readonly after: ElementPatch }

export type Undoable =
  | { readonly steps: readonly NodeStep[] }
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
  | {
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly background: { readonly before: Color | null; readonly after: Color | null }
    }
  | {
      readonly stack: ElementId
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: ElementId | null
      readonly after: ElementId | null
    }

export type Turns = { readonly ok: true; readonly commands: readonly Command[] } | { readonly ok: false }

const changed: Turns = { ok: false }

function spotOf(register: Register, file: readonly SlideId[], id: SlideId): SlideSpot | undefined {
  const known = register.file.length > 0 ? register.file : file
  const spot = foldSlides({ file: known, order: register.order }).find((each) => each.id === id)
  return spot === undefined ? undefined : { present: spot.present, key: spot.key }
}

function elementOf(edit: Exclude<ElementCommand, ElementOrder>): ElementId {
  return edit.slide === "element-add" ? edit.element.node : edit.node
}

function stackUndoable(edit: ElementOrder, file: readonly SlideId[]): Undoable | null {
  const place = sitsBefore(edit.among, edit.node)
  if (place === undefined) return null
  return { stack: edit.node, slide: edit.id, file, before: place, after: edit.before }
}

export function slideUndoable(register: Register, file: readonly SlideId[], edit: SlideCommand): Undoable | null {
  const decision = decide(register, { command: "slide", file, edit })
  if (decision.decision !== "apply") return null
  if (edit.slide === "background") {
    return { slide: edit.id, file, background: { before: backgroundOf(register, edit.id), after: edit.color } }
  }
  if (edit.slide === "element-order") return stackUndoable(edit, file)
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

function holderOf(register: Register, step: NodeStep): ValueHolder {
  const named = valueHolders.find((holder) => step.after[holder] !== undefined)
  return named ?? valueHolder(register, step.node, "person")
}

function stepCommands(register: Register, steps: readonly NodeStep[], from: "before" | "after"): Command[] | null {
  const to = from === "before" ? "after" : "before"
  const commands: Command[] = []
  for (const step of steps) {
    const body = register.nodes.includes(step.node) ? register.elements[step.node] : undefined
    const holder = holderOf(register, step)
    const values = formatOne(step[to], holder)
    if (body === undefined || values === null || !shows(shownPatch(body, holder), step[from])) return null
    commands.push(...values.map((value): Command => ({ command: "person", ...value, node: step.node })))
  }
  return commands
}

function stepTurn(register: Register, steps: readonly NodeStep[], from: "before" | "after"): Turns {
  const commands = stepCommands(register, steps, from)
  if (commands === null) return changed
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") return changed
    current = decision.register
  }
  return { ok: true, commands }
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

function landing(register: Register, command: Command): Turns {
  return decide(register, command).decision === "apply" ? { ok: true, commands: [command] } : changed
}

function turn(register: Register, undoable: Undoable, from: "before" | "after"): Turns {
  const to = from === "before" ? "after" : "before"
  if ("steps" in undoable) return stepTurn(register, undoable.steps, from)
  const file = register.file.length > 0 ? register.file : undoable.file
  if ("background" in undoable) {
    const color = undoable.background
    if (!sameColor(backgroundOf(register, undoable.slide), color[from])) return changed
    const edit: SlideCommand = { slide: "background", id: undoable.slide, color: color[to] }
    return landing(register, { command: "slide", file, edit })
  }
  if ("stack" in undoable) {
    const chain = elementStacks(register).find(
      (stack) => stack.slide === undoable.slide && stack.ids.includes(undoable.stack),
    )
    if (chain === undefined) return changed
    const place = sitsBefore(chain.ids, undoable.stack)
    if (place !== undoable[from] || undoable[from] === undoable[to]) return changed
    const edit: SlideCommand = {
      slide: "element-order",
      id: undoable.slide,
      node: undoable.stack,
      before: undoable[to],
      among: chain.ids,
    }
    return landing(register, { command: "slide", file, edit })
  }
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

export function undoOf(register: Register, undoable: Undoable): Turns {
  return turn(register, undoable, "after")
}

export function redoOf(register: Register, undoable: Undoable): Turns {
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
  if (edit.slide === "background") {
    const before = backgroundOf({ order: register.order.slice(0, at) }, edit.id)
    return { slide: edit.id, file: register.file, background: { before, after: edit.color } }
  }
  if (edit.slide === "element-order") return stackUndoable(edit, register.file)
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
    for (const command of undone.commands) {
      const decision = decide(current, command)
      if (decision.decision !== "apply") return null
      current = decision.register
    }
  }
  return current
}
