import { decide, landedPatch, shownPatch, valueHolder, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { elementCommand, elementGone, type ElementCommand, type ElementOrder } from "./element-order.js"
import { elementStacks, sitsBefore } from "./element-stack.js"
import { groupCommand, groupFormed, groupNode, type GroupCommand } from "./element-group.js"
import { rowsKept } from "./group-place.js"
import { ungroupTurn } from "./group-turn.js"
import type { OrderKey } from "./order-key.js"
import { openingElement } from "./slide-floor.js"
import { readTextValue } from "./text-value.js"
import { foldSlides, type SlideCommand, type SlideState } from "./slide-order.js"
import { format } from "./format.js"
import {
  boxPatch,
  formatOne,
  netPatch,
  rowOf,
  shownOver,
  shows,
  type ElementPatch,
  type Row,
  type ValueHolder,
} from "./row.js"

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
      readonly elements: readonly { readonly node: ElementId; readonly shown: ElementPatch }[]
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: boolean
      readonly after: boolean
    }
  | {
      readonly stack: ElementId
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: ElementId | null
      readonly after: ElementId | null
    }
  | {
      readonly group: ElementId
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: boolean
      readonly after: boolean
    }

type ElementsUndoable = Extract<Undoable, { readonly elements: unknown }>

type ElementEdit = Exclude<ElementCommand, ElementOrder>

export type Turns =
  | { readonly ok: true; readonly commands: readonly Command[]; readonly undoable: Undoable }
  | { readonly ok: false }

const changed: Turns = { ok: false }

function spotOf(register: Register, file: readonly SlideId[], id: SlideId): SlideSpot | undefined {
  const known = register.file.length > 0 ? register.file : file
  const spot = foldSlides({ file: known, order: register.order }).find((each) => each.id === id)
  return spot === undefined ? undefined : { present: spot.present, key: spot.key }
}

function openingOf(register: Register, node: ElementId): ElementPatch {
  const opening = openingElement(register, node)
  const rows: Row[] = []
  if (typeof opening?.value === "string")
    rows.push(rowOf({ value: opening.value }, valueHolder(register, node, "person")))
  if (opening?.box !== undefined && opening.box !== null) rows.push({ v: 1, patch: boxPatch(opening.box) })
  return netPatch(rows)
}

function noCharacters(value: string): boolean {
  const text = readTextValue(value)
  return text === null ? value === "" : text.every((paragraph) => paragraph.runs.every((run) => run.text === ""))
}

function shownWith(register: Register, node: ElementId, landed: ElementPatch): ElementPatch {
  const shown = shownOver(openingOf(register, node), landed)
  const text = shown.text?.value
  if (typeof text !== "object" || !noCharacters(text.set)) return shown
  return { ...shown, text: { ...shown.text, value: { set: "" } } }
}

function shownOn(register: Register, node: ElementId): ElementPatch {
  const body = register.elements[node]
  return shownWith(register, node, body === undefined ? {} : landedPatch(body, valueHolder(register, node, "person")))
}

function stillShows(register: Register, node: ElementId, shown: ElementPatch): boolean {
  const now = shownOn(register, node)
  return shows(now, shown) && shows(shown, now)
}

function elementOf(edit: ElementEdit): ElementId {
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
  if (edit.slide === "element-order") return stackUndoable(edit, file)
  if (groupCommand(edit)) {
    const group = groupNode(edit)
    return {
      group,
      slide: edit.id,
      file,
      before: groupFormed(register, group),
      after: groupFormed(decision.register, group),
    }
  }
  if (elementCommand(edit)) return elementsUndoable(register, file, [edit])
  const after = spotOf(decision.register, file, edit.id)
  if (after === undefined) return null
  const before = spotOf(register, file, edit.id) ?? { present: false, key: after.key }
  return { slide: edit.id, file, before, after }
}

export function elementsUndoable(
  register: Register,
  file: readonly SlideId[],
  edits: readonly ElementEdit[],
): Undoable | null {
  let current = register
  let first: { readonly edit: ElementEdit; readonly before: boolean; readonly after: boolean } | null = null
  const nodes: ElementId[] = []
  for (const edit of edits) {
    if (first !== null && (edit.id !== first.edit.id || edit.slide !== first.edit.slide)) continue
    const decision = decide(current, { command: "slide", file, edit })
    if (decision.decision !== "apply") continue
    const node = elementOf(edit)
    const before: boolean = edit.slide !== "element-add" && !elementGone(current, node)
    first ??= { edit, before, after: !elementGone(decision.register, node) }
    nodes.push(node)
    current = decision.register
  }
  if (first === null) return null
  const elements = nodes.map((node) => ({ node, shown: shownOn(current, node) }))
  return { elements, slide: first.edit.id, file, before: first.before, after: first.after }
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
    const values = formatOne(step[to], holder) ?? [{ v: format, patch: step[to] }]
    if (body === undefined || !shows(shownPatch(body, holder), step[from])) return null
    commands.push(...values.map((value): Command => ({ command: "person", ...value, node: step.node })))
  }
  return commands
}

function applying(register: Register, commands: readonly Command[] | null): readonly Command[] | null {
  if (commands === null) return null
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") return null
    current = decision.register
  }
  return commands
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

function elementsTurn(register: Register, undoable: ElementsUndoable, from: "before" | "after"): Turns {
  const to = from === "before" ? "after" : "before"
  if (undoable[from] === undoable[to]) return changed
  const turning = undoable.elements.filter((each) => elementGone(register, each.node) !== undoable[from])
  if (turning.length === 0) return changed
  if (!undoable[to] && turning.some((each) => !stillShows(register, each.node, each.shown))) return changed
  const file = register.file.length > 0 ? register.file : undoable.file
  const commands = applying(
    register,
    turning.map(({ node }): Command => {
      const edit: SlideCommand = undoable[to]
        ? { slide: "element-restore", id: undoable.slide, node }
        : { slide: "element-remove", id: undoable.slide, node }
      return { command: "slide", file, edit }
    }),
  )
  return commands === null ? changed : { ok: true, commands, undoable: { ...undoable, elements: turning } }
}

function landing(register: Register, command: Command): readonly Command[] | null {
  return applying(register, [command])
}

function turnCommands(
  register: Register,
  undoable: Exclude<Undoable, ElementsUndoable>,
  from: "before" | "after",
): readonly Command[] | null {
  const to = from === "before" ? "after" : "before"
  if ("steps" in undoable) return applying(register, stepCommands(register, undoable.steps, from))
  const file = register.file.length > 0 ? register.file : undoable.file
  if ("stack" in undoable) {
    const chain = elementStacks(register).find(
      (stack) => stack.slide === undoable.slide && stack.ids.includes(undoable.stack),
    )
    if (chain === undefined) return null
    const place = sitsBefore(chain.ids, undoable.stack)
    if (place !== undoable[from] || undoable[from] === undoable[to]) return null
    const edit: SlideCommand = {
      slide: "element-order",
      id: undoable.slide,
      node: undoable.stack,
      before: undoable[to],
      among: chain.ids,
    }
    return landing(register, { command: "slide", file, edit })
  }
  if ("group" in undoable) {
    if (groupFormed(register, undoable.group) !== undoable[from] || undoable[from] === undoable[to]) return null
    if (undoable[to]) {
      const edit: SlideCommand = { slide: "element-regroup", id: undoable.slide, node: undoable.group }
      return landing(register, { command: "slide", file, edit })
    }
    return ungroupTurn(register, file, undoable.slide, undoable.group)
  }
  if (!sits(spotOf(register, undoable.file, undoable.slide), undoable[from])) return null
  const edit = slideTurn(undoable[from], undoable[to], undoable.slide)
  if (edit === null) return null
  return landing(register, { command: "slide", file, edit })
}

function turn(register: Register, undoable: Undoable, from: "before" | "after"): Turns {
  if ("elements" in undoable) return elementsTurn(register, undoable, from)
  const commands = turnCommands(register, undoable, from)
  return commands === null ? changed : { ok: true, commands, undoable }
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
  if (edit.slide === "element-order") return stackUndoable(edit, register.file)
  if (elementCommand(edit)) {
    const node = elementOf(edit)
    if (edit.slide === "element-add" && personEdited(register, node)) return null
    const before = register.order.slice(0, at)
    const upTo = register.order.slice(0, at + 1)
    return {
      elements: [{ node, shown: shownWith(register, node, {}) }],
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

function groupUndone(register: Register, edit: GroupCommand): Register | null {
  const node = groupNode(edit)
  const formed = groupFormed(register, node)
  if (edit.slide === "element-ungroup" ? formed : !formed) return register
  if (edit.slide === "element-group" && (personEdited(register, node) || !rowsKept(register, edit))) return null
  if (edit.slide === "element-regroup" && personEdited(register, node)) return null
  const back: SlideCommand =
    edit.slide === "element-ungroup"
      ? { slide: "element-regroup", id: edit.id, node }
      : { slide: "element-ungroup", id: edit.id, node }
  const decision = decide(register, { command: "slide", file: register.file, edit: back })
  return decision.decision === "apply" ? decision.register : null
}

export function undoSlides(register: Register, runId: string): Register | null {
  let current = register
  for (let at = register.order.length - 1; at >= 0; at -= 1) {
    const edit = register.order[at]
    if (edit === undefined || edit.runId !== runId) continue
    if (groupCommand(edit)) {
      const turned = groupUndone(current, edit)
      if (turned === null) return null
      current = turned
      continue
    }
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
