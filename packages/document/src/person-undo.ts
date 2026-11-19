import { gridUndoable } from "./grid-undo.js"
import type { GridUndoable, GridTurn } from "./grid-order.js"
import { decide, landedPatch, shownPatch, valueHolder, type Command, type Register } from "./decide.js"
import { readSlideId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { elementCommand, elementGone, type ElementCommand, type ElementOrder } from "./element-order.js"
import { elementStacks, sitsBefore } from "./element-stack.js"
import { groupCommand, groupFormed, groupNode, type GroupCommand } from "./element-group.js"
import { rowsKept } from "./group-place.js"
import { regroupTurn, ungroupTurn } from "./group-turn.js"
import { joinEdit, joinTurn, spotNow, type Spot } from "./frame-layout.js"
import type { OrderKey } from "./order-key.js"
import { openingElement } from "./slide-floor.js"
import { readTextValue } from "./text-value.js"
import { foldSlides, type SlideCommand } from "./slide-order.js"
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
  | {
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: SlideSpot
      readonly after: SlideSpot
    }
  | GridUndoable
  | { readonly steps: readonly NodeStep[] }
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
  | {
      readonly joined: ElementId
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: Spot
      readonly after: Spot
    }

type ElementsUndoable = Extract<Undoable, { readonly elements: unknown }>

type ElementEdit = Exclude<ElementCommand, ElementOrder>

export type Turns =
  | { readonly ok: true; readonly commands: readonly Command[]; readonly undoable: Undoable }
  | { readonly ok: false }

const changed: Turns = { ok: false }

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
  if (edit.slide === "element-join") {
    const before = spotNow(register, edit.member.node)
    if (before === null) return null
    const after = { frame: edit.frame, before: edit.before, box: edit.member.box }
    return { joined: edit.member.node, slide: edit.id, file, before, after }
  }
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
  return gridUndoable(register, decision.register, file, edit)
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
    if (first !== null && edit.slide !== first.edit.slide) continue
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
  for (const step of from === "after" ? steps.toReversed() : steps) {
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
      const id = readSlideId(shapeOf(node).slide) ?? undoable.slide
      const edit: SlideCommand = undoable[to]
        ? { slide: "element-restore", id, node }
        : { slide: "element-remove", id, node }
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
  if ("spots" in undoable) {
    const inverse = <T>(step: { readonly before: T; readonly after: T }) => ({ before: step[from], after: step[to] })
    const turn: GridTurn = {
      spots: undoable.spots.map((step) => ({ id: step.id, ...inverse(step) })),
      heads: undoable.heads.map((step) => ({ id: step.id, ...inverse(step) })),
      rows: from === "before" ? undoable.groupsBefore : undoable.groupsAfter,
    }
    return landing(register, {
      command: "slide",
      file,
      edit: { slide: "grid-turn", grid: undoable.grid, turn },
    })
  }
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
  if ("joined" in undoable) {
    const now = spotNow(register, undoable.joined)
    const was = undoable[from]
    if (now === null || now.frame !== was.frame || now.before !== was.before) return null
    return joinTurn(register, file, undoable.joined, undoable[to])
  }
  if ("group" in undoable) {
    if (groupFormed(register, undoable.group) !== undoable[from] || undoable[from] === undoable[to]) return null
    if (undoable[to]) return regroupTurn(register, file, undoable.slide, undoable.group)
    return ungroupTurn(register, file, undoable.slide, undoable.group, from === "after" ? "made" : "laid")
  }
  const spot = foldSlides({ ...register, file }).find((spot) => spot.id === undoable.slide)
  if (
    (spot?.present ?? false) !== undoable[from].present ||
    (undoable[from].present && spot?.key !== undoable[from].key)
  )
    return null
  const before = undoable[from],
    after = undoable[to]
  const edit: SlideCommand | null =
    before.present && !after.present
      ? { slide: "remove", id: undoable.slide }
      : !before.present && after.present
        ? { slide: "restore", id: undoable.slide, key: after.key }
        : before.present && after.present && before.key !== after.key
          ? { slide: "move", id: undoable.slide, key: after.key }
          : null
  if (edit === null) return null
  const projected = decide(register, { command: "slide", file, edit })
  if (projected.decision !== "apply") return null
  const planned = gridUndoable(register, projected.register, file, edit)
  return landing(register, {
    command: "slide",
    file,
    edit: {
      slide: "grid-turn",
      grid: planned.grid,
      turn: { spots: planned.spots, heads: planned.heads, rows: planned.groupsBefore },
    },
  })
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

function personEdited(register: Register, node: ElementId): boolean {
  return register.elements[node]?.landed.some((row) => row.actor === "person" && row.visible) === true
}

function fencedSince(
  register: Register,
  at: number,
  edit: SlideCommand,
  turns: (row: SlideCommand) => boolean,
): boolean {
  return register.order.slice(at + 1).some((row) => row.runId !== edit.runId && turns(row))
}

function undoableAt(register: Register, at: number, edit: SlideCommand): Undoable | null {
  if (edit.slide === "element-order") return stackUndoable(edit, register.file)
  if (elementCommand(edit)) {
    const node = elementOf(edit)
    if (edit.slide === "element-add" && personEdited(register, node)) return null
    const turnsNode = (row: SlideCommand) =>
      (row.slide === "element-remove" || row.slide === "element-restore") && row.node === node
    if (fencedSince(register, at, edit, turnsNode)) return null
    const before = register.order.slice(0, at)
    const upTo = register.order.slice(0, at + 1)
    return {
      elements: [{ node, shown: shownWith(register, node, {}) }],
      slide: edit.id,
      file: register.file,
      before: edit.slide !== "element-add" && !elementGone({ ...register, order: before }, node),
      after: !elementGone({ ...register, order: upTo }, node),
    }
  }
  if (edit.slide === "grid-turn") return null
  const ids =
    edit.slide === "move-many" || edit.slide === "remove-many"
      ? edit.ids
      : edit.slide === "clone-many"
        ? edit.copies.map((copy) => copy.id)
        : [edit.id]
  const turnsSlide = (row: SlideCommand) =>
    ((row.slide === "remove" || row.slide === "restore") && ids.includes(row.id)) ||
    (row.slide === "remove-many" && row.ids.some((id) => ids.includes(id))) ||
    (row.slide === "grid-turn" &&
      row.turn.spots.some((step) => ids.includes(step.id) && step.before.present !== step.after.present))
  if (fencedSince(register, at, edit, turnsSlide)) return null
  return gridUndoable(
    { ...register, order: register.order.slice(0, at) },
    { ...register, order: register.order.slice(0, at + 1) },
    register.file,
    edit,
  )
}

function groupUndone(register: Register, edit: GroupCommand): Register | null {
  if (edit.slide === "element-join") return null
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
    if (edit.slide === "element-join") {
      const spot = spotNow({ ...register, order: register.order.slice(0, at) }, edit.member.node)
      const back = spot === null ? null : joinEdit(current, edit.member.node, spot)
      const decision = back === null ? null : decide(current, { command: "slide", file: register.file, edit: back })
      if (decision === null || decision.decision !== "apply") return null
      current = decision.register
      continue
    }
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
