export type Phase = "idle" | "running" | "stopped" | "undone"

export type Actor = "person" | "agent"

export type NodeName = "a" | "b"

export type Landed = {
  readonly actor: Actor
  readonly value: string
  readonly visible: boolean
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
}

export type Register = {
  readonly route: string
  readonly floor: string
  readonly landed: readonly Landed[]
  readonly phase: Phase
  readonly runId: string | null
  readonly readAt: number | null
  readonly guarded: boolean
  readonly claimed: number | null
  readonly stoppedAt: number | null
  readonly nodes: readonly NodeName[]
  readonly readNodes: readonly NodeName[] | null
  readonly b: NodeRegister | null
}

export type Command =
  | { readonly command: "person"; readonly value: string; readonly node?: NodeName }
  | {
      readonly command: "agent"
      readonly runId: string
      readonly readAt: number
      readonly value: string
      readonly node?: NodeName
    }
  | { readonly command: "start"; readonly runId: string; readonly node?: NodeName }
  | { readonly command: "stop"; readonly runId: string; readonly node?: NodeName }
  | { readonly command: "undo"; readonly runId: string; readonly node?: NodeName }
  | { readonly command: "add"; readonly node: "b" }
  | { readonly command: "remove"; readonly node: NodeName }
  | { readonly command: "read"; readonly runId: string; readonly node: NodeName }

export type Refusal = "stale" | "person-protected" | "run-fenced" | "dead" | "present"

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
  }
}

export function openRegister(floor: string, route: string): Register {
  return {
    ...openNode(floor, route),
    nodes: ["a"],
    readNodes: null,
    b: null,
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
  }
}

function apply(register: Register): Decision {
  return { decision: "apply", register, route: register.route }
}

function refuse(code: Refusal): Decision {
  return { decision: "refuse", code }
}

function listed(hasA: boolean, hasB: boolean): readonly NodeName[] {
  const nodes: NodeName[] = []
  if (hasA) {
    nodes.push("a")
  }
  if (hasB) {
    nodes.push("b")
  }
  return nodes
}

function land(register: Register, node: NodeName, body: NodeRegister): Decision {
  if (node === "a") {
    return apply({
      ...body,
      nodes: register.nodes,
      readNodes: register.readNodes,
      b: register.b,
    })
  }
  return apply({ ...register, b: body })
}

function visibleAgent(register: NodeRegister): boolean {
  return register.landed.some((row) => row.visible && row.actor === "agent")
}

function personEdit(register: NodeRegister, value: string): NodeRegister {
  const guarded = register.phase === "running" && !visibleAgent(register) ? true : register.guarded
  const landed = [...register.landed, { actor: "person" as const, value, visible: true }]
  return { ...register, landed, guarded }
}

function startRun(register: NodeRegister, runId: string): Edited {
  if (register.phase !== "idle") {
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
    },
  }
}

function agentLanded(register: NodeRegister): boolean {
  return register.landed.some((row) => row.actor === "agent")
}

function agentEdit(register: NodeRegister, runId: string, readAt: number, value: string): Edited {
  if (register.phase !== "running" || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  if (readAt !== version(register)) {
    return { decision: "refuse", code: "stale" }
  }
  if (register.guarded) {
    return { decision: "refuse", code: "person-protected" }
  }
  if (agentLanded(register)) {
    return { decision: "refuse", code: "run-fenced" }
  }
  const landed = [...register.landed, { actor: "agent" as const, value, visible: true }]
  return { decision: "apply", body: { ...register, landed, claimed: readAt } }
}

function stopRun(register: NodeRegister, runId: string): Edited {
  if (register.phase !== "running" || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  return { decision: "apply", body: { ...register, phase: "stopped", stoppedAt: version(register) } }
}

export function decideUndo(register: NodeRegister, runId: string): Edited {
  if ((register.phase !== "running" && register.phase !== "stopped") || register.runId !== runId) {
    return { decision: "refuse", code: "run-fenced" }
  }
  const landed = register.landed.map((row) =>
    row.actor === "agent" ? { actor: "agent" as const, value: row.value, visible: false } : row,
  )
  return { decision: "apply", body: { ...register, phase: "undone", landed } }
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

function addNode(register: Register): Decision {
  if (register.nodes.includes("b")) {
    return refuse("present")
  }
  const b = register.b ?? openNode(register.floor, register.route)
  return apply({ ...register, nodes: listed(register.nodes.includes("a"), true), b })
}

function removeNode(register: Register, node: NodeName): Decision {
  return apply({
    ...register,
    nodes: listed(
      node === "a" ? false : register.nodes.includes("a"),
      node === "b" ? false : register.nodes.includes("b"),
    ),
  })
}

function readNodes(register: Register, node: NodeName, runId: string): Decision {
  const body = node === "a" ? nodeOf(register) : register.b
  if (body === null) {
    throw new Error("missing node")
  }
  if (runId !== "s" || (body.phase !== "stopped" && body.phase !== "undone")) {
    return refuse("run-fenced")
  }
  return apply({ ...register, readNodes: [...register.nodes] })
}

function editNode(register: Register, node: NodeName, command: Command): Decision {
  const current = node === "a" ? nodeOf(register) : register.b
  if (current === null) {
    throw new Error("missing node")
  }
  if (command.command === "person") {
    return land(register, node, personEdit(current, command.value))
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
  return land(register, node, edited.body)
}

export function decide(register: Register, command: Command): Decision {
  if (command.command === "add") {
    return addNode(register)
  }
  const node = command.node ?? "a"
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
