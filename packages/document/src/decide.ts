import type { Box } from "./box.js"
import type { DeckIndex } from "./deck-index.js"
import { legacyElement, rootElement, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { limits, overLimit } from "./limits.js"
import { floorFits, openingElement } from "./slide-floor.js"
import { elementGone } from "./element-order.js"
import { applySlide, openSlides, slideGone, type SlideCommand } from "./slide-order.js"
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

export type RootRegister = NodeRegister & {
  readonly index?: DeckIndex
  readonly nodes: readonly ElementId[]
  readonly readNodes: readonly ElementId[] | null
  readonly elements: Readonly<Partial<Record<ElementId, NodeRegister>>>
  readonly file?: readonly SlideId[]
  readonly order?: readonly SlideCommand[]
  readonly b?: NodeRegister | null
}

export type StoredRegister = Register | RootRegister

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

function textRows(register: NodeRegister): readonly string[] {
  return visibleRows(register).flatMap((row) => (row.property === "box" ? [] : [row.value]))
}

export function currentValue(register: NodeRegister): string {
  return textRows(register).at(-1) ?? register.floor
}

export function history(register: NodeRegister): readonly string[] {
  return textRows(register)
}

export function currentBox(register: NodeRegister): Box | null {
  const boxes = visibleRows(register).flatMap((row) => (row.property === "box" ? [row.value] : []))
  return boxes.at(-1) ?? register.floorBox ?? null
}

function nodeOf(register: NodeRegister): NodeRegister {
  return {
    route: register.route,
    floor: register.floor,
    ...(register.floorBox === undefined ? {} : { floorBox: register.floorBox }),
    landed: register.landed,
    version: version(register),
    phase: register.phase,
    runId: register.runId,
    readAt: register.readAt,
    guarded: register.guarded,
    claimed: register.claimed,
    stoppedAt: register.stoppedAt,
    slides: register.slides,
    bytes: register.bytes,
  }
}

function legacyBody(stored: RootRegister): readonly (readonly [ElementId, NodeRegister])[] {
  if (Object.hasOwn(stored.elements, legacyElement) || !Object.hasOwn(stored, "b")) return []
  const body = stored.b
  if (body === undefined || body === null) return []
  return [[legacyElement, body]]
}

const rootFields = ["landed", "version", "phase", "runId", "readAt", "guarded", "claimed", "stoppedAt", "b"] as const

function rooted(stored: StoredRegister): stored is RootRegister {
  return rootFields.some((field) => Object.hasOwn(stored, field))
}

function keptSlides(stored: StoredRegister): {
  readonly file: readonly SlideId[]
  readonly order: readonly SlideCommand[]
} {
  const slides = openSlides()
  return { file: stored.file ?? slides.file, order: stored.order ?? slides.order }
}

export function foldRegister(stored: StoredRegister): Register {
  if (!rooted(stored)) {
    return stored.file !== undefined && stored.order !== undefined ? stored : { ...stored, ...keptSlides(stored) }
  }
  const kept = Object.entries(stored.elements).flatMap(([id, body]) =>
    body === undefined ? [] : [[id as ElementId, body] as const],
  )
  const first = nodeOf({ ...stored.elements[rootElement], ...stored })
  return {
    route: stored.route,
    ...(stored.index === undefined ? {} : { index: stored.index }),
    floor: stored.floor,
    slides: stored.slides,
    bytes: stored.bytes,
    ...keptSlides(stored),
    nodes: stored.nodes,
    readNodes: stored.readNodes,
    elements: Object.fromEntries([...kept, ...legacyBody(stored), [rootElement, first]]),
  }
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

function personEdit(register: NodeRegister, edit: Value): NodeRegister {
  const guarded = register.phase === "running" ? true : register.guarded
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

function editNode(register: Register, id: ElementId, command: Command): Decision {
  const current = storedBody(register, id)
  if (current === null) {
    throw new Error("missing node")
  }
  if (command.command === "person") {
    return place(register, id, personEdit(current, command))
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

export function decide(stored: StoredRegister, command: Command): Decision {
  const register = foldRegister(stored)
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
  if (
    (command.command === "person" || command.command === "agent") &&
    command.property === "box" &&
    openingElement(register, node)?.grouped === true
  ) {
    return refuse("group-box")
  }
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
