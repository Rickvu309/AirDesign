import type { Box } from "./box.js"
import type { DeckIndex } from "./deck-index.js"
import { rootElement, shapeOf, slideKind, templateStyleOwned, type ElementId, type SlideId } from "./element-id.js"
import { limits, overLimit } from "./limits.js"
import { floorFits, openingElement } from "./slide-floor.js"
import { elementGone } from "./element-order.js"
import { groupedNow } from "./element-group.js"
import { frameNow, framedNow } from "./frame-layout.js"
import { measuredOnly } from "./measured-row.js"
import { boxFields, boxOnly, indexFacts, takes, type ElementFacts, type Wanted } from "./element-takes.js"
import { applySlide, openSlides, slideGone, type SlideCommand } from "./slide-order.js"
import {
  fieldsOf,
  netPatch,
  rowOf,
  type ElementPatch,
  type FieldEdit,
  type TraitPatch,
  type ValueHolder,
} from "./row.js"
import type { FieldKey } from "./traits.js"
import { storedValue, type Value } from "./value.js"

export type Phase = "idle" | "running" | "stopped" | "undone"

export type Actor = "person" | "agent"

export type Landed = Value & {
  readonly actor: Actor
  readonly visible: boolean
  readonly runId?: string
}

export type NodeRegister = {
  readonly route: string
  readonly floor: string
  readonly floorBox?: Box
  readonly landed: readonly Landed[]
  readonly version?: number
  readonly phase: Phase
  readonly runId: string | null
  readonly readAt: number | null
  readonly guarded: boolean
  readonly claimed: number | null
  readonly stoppedAt: number | null
  readonly slides: number
  readonly bytes: number
}

export type Register = {
  readonly index?: DeckIndex
  readonly sectionStarts?: readonly SlideId[]
  readonly route: string
  readonly floor: string
  readonly slides: number
  readonly bytes: number
  readonly file: readonly SlideId[]
  readonly order: readonly SlideCommand[]
  readonly ended?: readonly string[]
  readonly lastRun?: { readonly runId: string; readonly since: number; readonly revision: number }
  readonly nodes: readonly ElementId[]
  readonly readNodes: readonly ElementId[] | null
  readonly elements: Readonly<Record<ElementId, NodeRegister>>
}

export type Command =
  | (Value & { readonly command: "person"; readonly node?: ElementId })
  | (Value & {
      readonly command: "agent"
      readonly runId: string
      readonly readAt: number
      readonly node?: ElementId
    })
  | { readonly command: "start"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "stop"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "undo"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "add"; readonly node: ElementId; readonly floor: string; readonly route: string }
  | { readonly command: "remove"; readonly node: ElementId }
  | { readonly command: "read"; readonly runId: string; readonly node: ElementId }
  | { readonly command: "slide"; readonly file: readonly SlideId[]; readonly edit: SlideCommand }

export const refusals = [
  "stale",
  "person-protected",
  "run-fenced",
  "dead",
  "present",
  "limit",
  "group-box",
  "locked",
  "kind",
] as const

export type Refusal = (typeof refusals)[number]

export type Decision =
  | { readonly decision: "apply"; readonly register: Register; readonly route: string }
  | { readonly decision: "refuse"; readonly code: Refusal }

type Edited =
  | { readonly decision: "apply"; readonly body: NodeRegister }
  | { readonly decision: "refuse"; readonly code: Refusal }

function openNode(floor: string, route: string): NodeRegister {
  return {
    route,
    floor,
    landed: [],
    phase: "idle",
    runId: null,
    readAt: null,
    guarded: false,
    claimed: null,
    stoppedAt: null,
    slides: 1,
    bytes: 0,
  }
}

export function openRegister(floor: string, route: string): Register {
  return {
    route,
    floor,
    slides: 1,
    bytes: 0,
    ...openSlides(),
    nodes: [rootElement],
    readNodes: null,
    elements: { [rootElement]: openNode(floor, route) },
  }
}

function visibleRows(register: NodeRegister): readonly Landed[] {
  return register.landed.filter((row) => row.visible)
}

function hiddenRows(register: NodeRegister): readonly Landed[] {
  return register.landed.filter((row) => !row.visible)
}

export function version(register: NodeRegister): number {
  return register.version ?? register.landed.length + hiddenRows(register).length
}

function heldText(row: Value, floor: string): readonly string[] {
  if (row.v === undefined) return row.property === "box" ? [] : [row.value]
  const edit = row.patch.text?.value ?? row.patch.notes?.value ?? row.patch.table?.value
  if (edit === undefined) return []
  return [typeof edit === "object" ? edit.set : floor]
}

function textRows(register: NodeRegister): readonly string[] {
  return visibleRows(register).flatMap((row) => heldText(row, register.floor))
}

export function currentValue(register: NodeRegister): string {
  return textRows(register).at(-1) ?? register.floor
}

export function history(register: NodeRegister): readonly string[] {
  return textRows(register)
}

function boxEdit(edit: FieldEdit<number> | undefined, now: number | undefined, opening: number | undefined) {
  if (edit === undefined) return now
  return typeof edit === "object" ? edit.set : opening
}

function patchedBox(box: Box | null, fields: TraitPatch<"box">, floor: Box | undefined): Box | null {
  const x = boxEdit(fields.x, box?.x, floor?.x)
  const y = boxEdit(fields.y, box?.y, floor?.y)
  const cx = boxEdit(fields.w, box?.cx, floor?.cx)
  const cy = boxEdit(fields.h, box?.cy, floor?.cy)
  return x === undefined || y === undefined || cx === undefined || cy === undefined ? box : { x, y, cx, cy }
}

export function currentBox(register: NodeRegister): Box | null {
  let box = register.floorBox ?? null
  for (const row of visibleRows(register)) {
    if (row.v === undefined) box = row.property === "box" ? row.value : box
    else if (row.patch.box !== undefined) box = patchedBox(box, row.patch.box, register.floorBox)
  }
  return box
}

function apply(register: Register, route: string): Decision {
  return { decision: "apply", register, route }
}

function refuse(code: Refusal): Decision {
  return { decision: "refuse", code }
}

function storedBody(register: Register, id: ElementId): NodeRegister | null {
  if (!Object.hasOwn(register.elements, id)) return null
  return register.elements[id] ?? null
}

function place(register: Register, id: ElementId, body: NodeRegister): Decision {
  return apply({ ...register, elements: { ...register.elements, [id]: body } }, body.route)
}

function personEdit(register: NodeRegister, edit: Value, measure: boolean): NodeRegister {
  const guarded = register.phase === "running" && !measure ? true : register.guarded
  const landed = [...register.landed, { actor: "person" as const, ...storedValue(edit), visible: true }]
  return { ...register, landed, version: version(register) + 1, guarded }
}

function startRun(register: NodeRegister, runId: string): Edited {
  if (register.phase === "running" || register.landed.some((row) => row.runId === runId)) {
    return { decision: "refuse", code: "run-fenced" }
  }
  return {
    decision: "apply",
    body: {
      ...register,
      phase: "running",
      runId,
      readAt: version(register),
      guarded: false,
      claimed: null,
      stoppedAt: null,
    },
  }
}

function agentEdit(register: NodeRegister, runId: string, readAt: number, edit: Value): Edited {
  if (register.phase !== "running" || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  if (register.guarded) {
    return { decision: "refuse", code: "person-protected" }
  }
  if (readAt !== version(register) && readAt !== register.claimed) {
    return { decision: "refuse", code: "stale" }
  }
  const landed = [...register.landed, { actor: "agent" as const, ...storedValue(edit), visible: true, runId }]
  return { decision: "apply", body: { ...register, landed, version: version(register) + 1, claimed: readAt } }
}

function stopRun(register: NodeRegister, runId: string): Edited {
  if (register.phase !== "running" || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  return { decision: "apply", body: { ...register, phase: "stopped", stoppedAt: version(register) } }
}

export function decideUndo(register: NodeRegister, runId: string): Edited {
  if (overLimit({ decks: 1, slides: register.slides, bytes: register.bytes })) {
    return { decision: "refuse", code: "limit" }
  }
  const rows = register.landed.filter((row) => row.runId === runId)
  if (rows.length > 0 && rows.every((row) => !row.visible)) {
    return { decision: "refuse", code: "run-fenced" }
  }
  const landed = register.landed.map((row) => (row.runId === runId ? { ...row, visible: false } : row))
  const hidden = { ...register, landed, version: version(register) + rows.filter((row) => row.visible).length }
  if (register.runId === runId && (register.phase === "running" || register.phase === "stopped")) {
    return { decision: "apply", body: { ...hidden, phase: "undone" } }
  }
  if (register.phase !== "running" && rows.length > 0) {
    return { decision: "apply", body: hidden }
  }
  return { decision: "refuse", code: "run-fenced" }
}

export function compactChain(register: NodeRegister, eligible: boolean): NodeRegister {
  if (!eligible) {
    return register
  }
  return {
    ...register,
    version: version(register),
    landed: visibleRows(register),
  }
}

function addNode(register: Register, id: ElementId, floor: string, route: string): Decision {
  if (id === rootElement || register.nodes.includes(id)) {
    return refuse("present")
  }
  const indexed = openingElement(register, id)
  if (register.nodes.length >= limits.elements && indexed === undefined) {
    return refuse("limit")
  }
  const body = storedBody(register, id) ?? {
    ...openNode(indexed?.value ?? floor, route),
    ...(indexed?.box === null || indexed?.box === undefined ? {} : { floorBox: indexed.box }),
  }
  return apply(
    { ...register, nodes: [...register.nodes, id], elements: { ...register.elements, [id]: body } },
    body.route,
  )
}

function removeNode(register: Register, id: ElementId): Decision {
  const body = storedBody(register, id)
  if (body === null) {
    throw new Error("missing node")
  }
  return apply({ ...register, nodes: register.nodes.filter((node) => node !== id) }, body.route)
}

function readNodes(register: Register, id: ElementId, runId: string): Decision {
  const body = storedBody(register, id)
  if (body === null) {
    throw new Error("missing node")
  }
  if (body.runId !== runId || (body.phase !== "stopped" && body.phase !== "undone")) {
    return refuse("run-fenced")
  }
  return apply({ ...register, readNodes: [...register.nodes] }, body.route)
}

function hostedSlide(id: ElementId): string | null {
  if (!id.includes(".")) return null
  return shapeOf(id).slide
}

export function elementFacts(register: Register, node: ElementId): ElementFacts | undefined {
  if (templateStyleOwned(node)) return { kind: "deck", text: false, grouped: false, animated: false }
  const kind = slideKind(node)
  if (kind !== null) return { kind, text: kind === "notes", grouped: false, animated: false }
  const opening = openingElement(register, node)
  if (opening === undefined) return undefined
  const frame = frameNow(register, node)
  const framed = framedNow(register, node)
  return {
    ...indexFacts(opening, false),
    grouped: groupedNow(register, node),
    ...(frame === null ? {} : { frame }),
    ...(framed === null ? {} : { framed }),
  }
}

export type Missing = {
  readonly facts: ElementFacts
  readonly missing: readonly Wanted[]
  readonly box: Box | null
}

export function valueHolder(register: Register, node: ElementId, actor: Actor): ValueHolder {
  if (slideKind(node) === "notes") return "notes"
  return actor === "person" && openingElement(register, node)?.kind === "table" ? "table" : "text"
}

export function landedPatch(register: NodeRegister, holder: ValueHolder): ElementPatch {
  return netPatch(visibleRows(register).map((row) => rowOf(row, holder)))
}

export function shownPatch(register: NodeRegister, holder: ValueHolder): ElementPatch {
  const floor: readonly Value[] = [
    { value: register.floor },
    ...(register.floorBox === undefined ? [] : [{ property: "box" as const, value: register.floorBox }]),
  ]
  return netPatch([...floor, ...visibleRows(register)].map((row) => rowOf(row, holder)))
}

function changedFields(patch: ElementPatch, box: Box | null): readonly FieldKey[] {
  const shown: Readonly<Record<string, number | undefined>> = { x: box?.x, y: box?.y, w: box?.cx, h: box?.cy }
  return fieldsOf(patch).filter((field) => {
    const side = field.startsWith("box.") ? field.slice(4) : null
    const edit: FieldEdit<unknown> | undefined =
      side === null ? undefined : patch.box?.[side as keyof TraitPatch<"box">]
    return side === null || typeof edit !== "object" || edit.set !== shown[side]
  })
}

export function editMissing(
  register: Register,
  edit: Value & { readonly command: "person" | "agent"; readonly node: ElementId },
): Missing | null {
  const facts = elementFacts(register, edit.node)
  if (facts === undefined) return null
  const body = storedBody(register, edit.node)
  const box = (body === null ? null : currentBox(body)) ?? openingElement(register, edit.node)?.box ?? null
  const holder = valueHolder(register, edit.node, edit.command)
  const wanted =
    edit.v === undefined
      ? edit.property === "box"
        ? boxFields(box, edit.value)
        : fieldsOf(rowOf(edit, holder).patch)
      : changedFields(edit.patch, box)
  const taken = takes(facts)
  const missing = wanted.filter((each) => !taken.includes(each))
  return missing.length === 0 ? null : { facts, missing, box }
}

function takenRefusal(register: Register, node: ElementId, command: Command): Refusal | null {
  if (command.command !== "person" && command.command !== "agent") return null
  const found = editMissing(register, { ...command, node })
  if (found === null) return null
  return found.facts.grouped && boxOnly(found.missing) ? "group-box" : "kind"
}

function editNode(register: Register, id: ElementId, command: Command): Decision {
  const current = storedBody(register, id)
  if (current === null) {
    throw new Error("missing node")
  }
  if (command.command === "person") {
    return place(register, id, personEdit(current, command, measuredOnly(command)))
  }
  const edited =
    command.command === "agent"
      ? agentEdit(current, command.runId, command.readAt, command)
      : command.command === "start"
        ? startRun(current, command.runId)
        : command.command === "stop"
          ? stopRun(current, command.runId)
          : command.command === "undo"
            ? decideUndo(current, command.runId)
            : null
  if (edited === null) {
    throw new Error("missing command")
  }
  if (edited.decision === "refuse") {
    return refuse(edited.code)
  }
  return place(register, id, edited.body)
}

export function decide(register: Register, command: Command): Decision {
  if (overLimit({ decks: 1, slides: register.slides, bytes: register.bytes })) {
    return refuse("limit")
  }
  if (command.command === "slide") {
    const opening = register.index?.slides
    if (
      opening !== undefined &&
      (opening.length !== command.file.length || opening.some((slide, position) => slide.id !== command.file[position]))
    )
      return refuse("stale")
    const applied = applySlide(register, command.file, command.edit)
    if (!applied.ok) return refuse(applied.code)
    if (!floorFits(register, command.edit)) return refuse("limit")
    return apply({ ...register, file: applied.state.file, order: applied.state.order }, register.route)
  }
  if (command.command === "add") {
    const supplied = command as { readonly node: ElementId; readonly floor?: string; readonly route?: string }
    return addNode(register, supplied.node, supplied.floor ?? register.floor, supplied.route ?? register.route)
  }
  const node = command.node ?? rootElement
  const taken = takenRefusal(register, node, command)
  if (taken !== null) return refuse(taken)
  if (!register.nodes.includes(node)) {
    return refuse("dead")
  }
  const slide = hostedSlide(node)
  if (
    slide !== null &&
    (command.command === "person" || command.command === "agent" || command.command === "start") &&
    (slideGone(register, slide) || elementGone(register, node))
  ) {
    return refuse("dead")
  }
  if (command.command === "remove") {
    return removeNode(register, node)
  }
  if (command.command === "read") {
    return readNodes(register, node, command.runId)
  }
  return editNode(register, node, command)
}
