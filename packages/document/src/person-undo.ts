import { gridUndoable } from "./grid-undo.js"
import type { GridUndoable, GridTurn } from "./grid-order.js"
import { decide, landedPatch, shownPatch, valueHolder, type Command, type Register } from "./decide.js"
import { measuredOnly, personWrote } from "./measured-row.js"
import { readSlideId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { elementCommand, elementGone, type ElementCommand, type ElementOrder } from "./element-order.js"
import { elementStacks, sitsBefore } from "./element-stack.js"
import { groupCommand, groupFormed, groupNode, type GroupCommand } from "./element-group.js"
import { rowsKept } from "./group-place.js"
import { regroupTurn, ungroupTurn } from "./group-turn.js"
import { joinEdit, joinTurn, spotNow, type Spot } from "./group-join.js"
import type { OrderKey } from "./order-key.js"
import { openingElement } from "./slide-floor.js"
import { noCharacters } from "./text-value.js"
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

const valueHolders: readonly ValueHolder[] = ["notes", "text"]

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
      readonly elements: readonly {
        readonly node: ElementId
        readonly shown: ElementPatch
        readonly before?: boolean
        readonly after?: boolean
      }[]
      readonly slide: SlideId
      readonly file: readonly SlideId[]
      readonly before: boolean
      readonly after: boolean
      readonly rows?: readonly NodeStep[]
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
      readonly rows?: readonly NodeStep[]
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
  if (typeof opening?.value === "string") rows.push(rowOf({ value: opening.value }, valueHolder(node)))
  if (opening?.box !== undefined && opening.box !== null) rows.push({ v: 1, patch: boxPatch(opening.box) })
  return netPatch(rows)
}

function shownWith(register: Register, node: ElementId, landed: ElementPatch): ElementPatch {
  const shown = shownOver(openingOf(register, node), landed)
  const text = shown.text?.value
  if (typeof text !== "object" || !noCharacters(text.set)) return shown
  return { ...shown, text: { ...shown.text, value: { set: "" } } }
}

function shownOn(register: Register, node: ElementId): ElementPatch {
  const body = register.elements[node]
  if (body === undefined) return shownWith(register, node, {})
  const written = { ...body, landed: body.landed.filter((row) => !measuredOnly(row)) }
  return shownWith(register, node, landedPatch(written, valueHolder(node)))
}

function stillShows(register: Register, node: ElementId, shown: ElementPatch): boolean {
  const now = shownOn(register, node)
  return shows(now, shown) && shows(shown, now)
}

function elementOf(edit: ElementEdit): ElementId {
  return edit.slide === "element-add" || edit.slide === "element-clone" ? edit.element.node : edit.node
}

function born(edit: ElementEdit): boolean {
  return edit.slide === "element-add" || edit.slide === "element-clone"
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

export function swapUndoable(
  register: Register,
  file: readonly SlideId[],
  added: readonly ElementEdit[],
  removed: readonly ElementEdit[],
): Undoable | null {
  const born = elementsUndoable(register, file, added)
  if (born === null || !("elements" in born)) return null
  let current = register
  for (const edit of added) {
    const decision = decide(current, { command: "slide", file, edit })
    if (decision.decision === "apply") current = decision.register
  }
  const gone = elementsUndoable(current, file, removed)
  if (gone === null || !("elements" in gone)) return born
  const turned = (undoable: typeof born) =>
    undoable.elements.map((each) => ({ ...each, before: undoable.before, after: undoable.after }))
  return { ...born, elements: [...turned(born), ...turned(gone)] }
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
    const before: boolean = !born(edit) && !elementGone(current, node)
    first ??= { edit, before, after: !elementGone(decision.register, node) }
    nodes.push(node)
    current = decision.register
  }
  if (first === null) return null
  const elements = nodes.map((node) => ({ node, shown: shownOn(current, node) }))
  return { elements, slide: first.edit.id, file, before: first.before, after: first.after }
}

function holderOf(step: NodeStep): ValueHolder {
  const named = valueHolders.find((holder) => step.after[holder] !== undefined)
  return named ?? valueHolder(step.node)
}

function stepCommands(register: Register, steps: readonly NodeStep[], from: "before" | "after"): Command[] | null {
  const to = from === "before" ? "after" : "before"
  const commands: Command[] = []
  for (const step of from === "after" ? steps.toReversed() : steps) {
    const body = register.nodes.includes(step.node) ? register.elements[step.node] : undefined
    const holder = holderOf(step)
    const values = formatOne(step[to], holder) ?? [{ v: format, patch: step[to] }]
    if (body === undefined || !shows(shownPatch(body, holder), step[from])) return null
    commands.push(...values.map((value): Command => ({ command: "person", ...value, node: step.node })))
  }
  return commands
}

function applying(register: Register, commands: readonly Command[] | null): readonly Command[] | null {
  return commands !== null && landedAll(register, commands) !== null ? commands : null
}

function elementsTurn(register: Register, undoable: ElementsUndoable, from: "before" | "after"): Turns {
  const to = from === "before" ? "after" : "before"
  type Turned = ElementsUndoable["elements"][number]
  const was = (each: Turned) => each[from] ?? undoable[from]
  const becomes = (each: Turned) => each[to] ?? undoable[to]
  const turning = undoable.elements.filter(
    (each) => was(each) !== becomes(each) && elementGone(register, each.node) !== was(each),
  )
  if (turning.length === 0) return changed
  const file = register.file.length > 0 ? register.file : undoable.file
  const slid = (each: Turned, edit: "element-restore" | "element-remove"): Command => {
    const id = readSlideId(shapeOf(each.node).slide) ?? undoable.slide
    return { command: "slide", file, edit: { slide: edit, id, node: each.node } }
  }
  const restores = turning.filter(becomes).map((each) => slid(each, "element-restore"))
  const restored = landedAll(register, restores)
  const rows = restored === null ? null : applying(restored, stepCommands(restored, undoable.rows ?? [], from))
  const written = restored === null || rows === null ? null : landedAll(restored, rows)
  const leaving = turning.filter((each) => !becomes(each))
  if (written === null || leaving.some((each) => !stillShows(written, each.node, each.shown))) return changed
  const commands = applying(register, [
    ...restores,
    ...(rows ?? []),
    ...leaving.map((each) => slid(each, "element-remove")),
  ])
  return commands === null ? changed : { ok: true, commands, undoable: { ...undoable, elements: turning } }
}

function landedAll(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const decision = decide(current, command)
    if (decision.decision !== "apply") return null
    current = decision.register
  }
  return current
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
    if (now === null || now.frame !== was.frame) return null
    return joinTurn(register, file, undoable.joined, undoable[to])
  }
  if ("group" in undoable) {
    if (groupFormed(register, undoable.group) !== undoable[from] || undoable[from] === undoable[to]) return null
    const rows = stepCommands(register, undoable.rows ?? [], from)
    if (rows === null) return null
    if (undoable[to]) {
      const regroup = regroupTurn(register, file, undoable.slide, undoable.group)
      return regroup === null ? null : applying(register, [...regroup, ...rows])
    }
    const ungroup = ungroupTurn(register, file, undoable.slide, undoable.group, from === "after" ? "made" : "laid")
    return ungroup === null ? null : applying(register, [...rows, ...ungroup])
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
  return register.elements[node]?.landed.some(personWrote) === true
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
    if (born(edit) && personEdited(register, node)) return null
    const turnsNode = (row: SlideCommand) =>
      (row.slide === "element-remove" || row.slide === "element-restore") && row.node === node
    if (fencedSince(register, at, edit, turnsNode)) return null
    const before = register.order.slice(0, at)
    const upTo = register.order.slice(0, at + 1)
    return {
      elements: [{ node, shown: shownWith(register, node, {}) }],
      slide: edit.id,
      file: register.file,
      before: !born(edit) && !elementGone({ ...register, order: before }, node),
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
