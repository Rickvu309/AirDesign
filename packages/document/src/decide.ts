import { legacyElement, rootElement, type ElementId } from "./element-id.js"
import { limits, overLimit } from "./limits.js"

export type Phase = "idle" | "running" | "stopped" | "undone"

export type Actor = "person" | "agent"

export type Landed = {
  readonly actor: Actor
  readonly value: string
  readonly visible: boolean
  readonly runId?: string
}

export type NodeRegister = {
  readonly route: string
  readonly floor: string
  readonly landed: readonly Landed[]
  readonly phase: Phase
  readonly runId: string | null
  readonly readAt: number | null
  readonly guarded: boolean
  readonly claimed: number | null
  readonly stoppedAt: number | null
  readonly slides: number
  readonly bytes: number
}

type ElementMap = Readonly<Partial<Record<ElementId, NodeRegister>>>

export type Register = NodeRegister & {
  readonly nodes: readonly ElementId[]
  readonly readNodes: readonly ElementId[] | null
  readonly elements: ElementMap
}

export type Command =
  | { readonly command: "person"; readonly value: string; readonly node?: ElementId }
  | {
      readonly command: "agent"
      readonly runId: string
      readonly readAt: number
      readonly value: string
      readonly node?: ElementId
    }
  | { readonly command: "start"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "stop"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "undo"; readonly runId: string; readonly node?: ElementId }
  | { readonly command: "add"; readonly node: ElementId; readonly floor: string; readonly route: string }
  | { readonly command: "remove"; readonly node: ElementId }
  | { readonly command: "read"; readonly runId: string; readonly node: ElementId }

export type Refusal = "stale" | "person-protected" | "run-fenced" | "dead" | "present" | "limit"

export type Decision =
  | { readonly decision: "apply"; readonly register: Register; readonly route: string }
  | { readonly decision: "refuse"; readonly code: Refusal }

type Edited =
  | { readonly decision: "apply"; readonly body: NodeRegister }
  | { readonly decision: "refuse"; readonly code: Refusal }

const openedElement = rootElement

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
    ...openNode(floor, route),
    nodes: [openedElement],
    readNodes: null,
    elements: {},
  }
}

function visibleRows(register: NodeRegister): readonly Landed[] {
  return register.landed.filter((row) => row.visible)
}

export function version(register: NodeRegister): number {
  return visibleRows(register).length
}

export function currentValue(register: NodeRegister): string {
  const last = visibleRows(register).at(-1)
  return last === undefined ? register.floor : last.value
}

export function history(register: NodeRegister): readonly string[] {
  return visibleRows(register).map((row) => row.value)
}

function nodeOf(register: Register): NodeRegister {
  return {
    route: register.route,
    floor: register.floor,
    landed: register.landed,
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

function apply(register: Register, route: string): Decision {
  return { decision: "apply", register, route }
}

function refuse(code: Refusal): Decision {
  return { decision: "refuse", code }
}

function pairedBody(register: Register): NodeRegister | null {
  if (!Object.hasOwn(register, "b")) return null
  const body = (register as { readonly b?: NodeRegister | null }).b
  if (body === undefined || body === null) return null
  return body
}

function ownBody(elements: ElementMap, id: ElementId): NodeRegister | null {
  if (!Object.hasOwn(elements, id)) return null
  return elements[id] ?? null
}

function elementsOf(register: Register, id: ElementId): ElementMap {
  if (ownBody(register.elements, id) !== null) return register.elements
  if (id !== legacyElement) return register.elements
  const paired = pairedBody(register)
  if (paired === null) return register.elements
  return { ...register.elements, [id]: paired }
}

function storedBody(register: Register, id: ElementId): NodeRegister | null {
  if (id === openedElement) return nodeOf(register)
  return ownBody(elementsOf(register, id), id)
}

function place(register: Register, id: ElementId, body: NodeRegister): Decision {
  if (id === openedElement) {
    return apply(
      {
        ...register,
        ...body,
        nodes: register.nodes,
        readNodes: register.readNodes,
        elements: register.elements,
      },
      body.route,
    )
  }
  return apply({ ...register, elements: { ...elementsOf(register, id), [id]: body } }, body.route)
}

function personEdit(register: NodeRegister, value: string): NodeRegister {
  const guarded = register.phase === "running" ? true : register.guarded
  const landed = [...register.landed, { actor: "person" as const, value, visible: true }]
  return { ...register, landed, guarded }
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

function agentEdit(register: NodeRegister, runId: string, readAt: number, value: string): Edited {
  if (register.phase !== "running" || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  if (register.guarded) {
    return { decision: "refuse", code: "person-protected" }
  }
  if (readAt !== version(register) && readAt !== register.claimed) {
    return { decision: "refuse", code: "stale" }
  }
  const landed = [...register.landed, { actor: "agent" as const, value, visible: true, runId }]
  return { decision: "apply", body: { ...register, landed, claimed: readAt } }
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
  if (register.runId === runId && (register.phase === "running" || register.phase === "stopped")) {
    return { decision: "apply", body: { ...register, phase: "undone", landed } }
  }
  if (register.phase !== "running" && rows.length > 0) {
    return { decision: "apply", body: { ...register, landed } }
  }
  return { decision: "refuse", code: "run-fenced" }
}

export function compactChain(register: NodeRegister, eligible: boolean): NodeRegister {
  if (!eligible) {
    return register
  }
  return {
    ...register,
    landed: register.landed.filter((row) => row.visible),
  }
}

function addNode(register: Register, id: ElementId, floor: string, route: string): Decision {
  if (id === openedElement || register.nodes.includes(id)) {
    return refuse("present")
  }
  if (register.nodes.length >= limits.elements) {
    return refuse("limit")
  }
  const elements = elementsOf(register, id)
  const kept = ownBody(elements, id)
  const body = kept ?? openNode(floor, route)
  return apply({ ...register, nodes: [...register.nodes, id], elements: { ...elements, [id]: body } }, body.route)
}

function removeNode(register: Register, id: ElementId): Decision {
  const body = storedBody(register, id)
  if (body === null) {
    throw new Error("missing node")
  }
  return apply(
    {
      ...register,
      nodes: register.nodes.filter((node) => node !== id),
      elements: elementsOf(register, id),
    },
    body.route,
  )
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

function editNode(register: Register, id: ElementId, command: Command): Decision {
  const current = storedBody(register, id)
  if (current === null) {
    throw new Error("missing node")
  }
  if (command.command === "person") {
    return place(register, id, personEdit(current, command.value))
  }
  const edited =
    command.command === "agent"
      ? agentEdit(current, command.runId, command.readAt, command.value)
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
  if (command.command === "add") {
    const supplied = command as { readonly node: ElementId; readonly floor?: string; readonly route?: string }
    return addNode(register, supplied.node, supplied.floor ?? register.floor, supplied.route ?? register.route)
  }
  const node = command.node ?? openedElement
  if (!register.nodes.includes(node)) {
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
