export type Phase = "idle" | "running" | "stopped" | "undone"

export type Actor = "person" | "agent"

export type Landed = {
  readonly actor: Actor
  readonly value: string
  readonly visible: boolean
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
}

export type Command =
  | { readonly command: "person"; readonly value: string }
  | { readonly command: "agent"; readonly runId: string; readonly readAt: number; readonly value: string }
  | { readonly command: "start"; readonly runId: string }
  | { readonly command: "stop"; readonly runId: string }
  | { readonly command: "undo"; readonly runId: string }

export type Refusal = "stale" | "person-protected" | "run-fenced"

export type Decision =
  | { readonly decision: "apply"; readonly register: Register; readonly route: string }
  | { readonly decision: "refuse"; readonly code: Refusal }

export function openRegister(floor: string, route: string): Register {
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

function visibleRows(register: Register): readonly Landed[] {
  return register.landed.filter((row) => row.visible)
}

export function version(register: Register): number {
  return visibleRows(register).length
}

export function currentValue(register: Register): string {
  const last = visibleRows(register).at(-1)
  return last === undefined ? register.floor : last.value
}

export function history(register: Register): readonly string[] {
  return visibleRows(register).map((row) => row.value)
}

function apply(register: Register): Decision {
  return { decision: "apply", register, route: register.route }
}

function refuse(code: Refusal): Decision {
  return { decision: "refuse", code }
}

function visibleAgent(register: Register): boolean {
  return register.landed.some((row) => row.visible && row.actor === "agent")
}

function personEdit(register: Register, value: string): Decision {
  const guarded = register.phase === "running" && !visibleAgent(register) ? true : register.guarded
  const landed = [...register.landed, { actor: "person" as const, value, visible: true }]
  return apply({ ...register, landed, guarded })
}

function startRun(register: Register, runId: string): Decision {
  if (register.phase !== "idle") {
    return refuse("run-fenced")
  }
  return apply({
    ...register,
    phase: "running",
    runId,
    readAt: version(register),
    guarded: false,
  })
}

function agentLanded(register: Register): boolean {
  return register.landed.some((row) => row.actor === "agent")
}

function agentEdit(register: Register, runId: string, readAt: number, value: string): Decision {
  if (register.phase !== "running" || register.runId !== runId) {
    return refuse("run-fenced")
  }
  if (readAt !== version(register)) {
    return refuse("stale")
  }
  if (register.guarded) {
    return refuse("person-protected")
  }
  if (agentLanded(register)) {
    return refuse("run-fenced")
  }
  const landed = [...register.landed, { actor: "agent" as const, value, visible: true }]
  return apply({ ...register, landed, claimed: readAt })
}

function stopRun(register: Register, runId: string): Decision {
  if (register.phase !== "running" || register.runId !== runId) {
    return refuse("run-fenced")
  }
  return apply({ ...register, phase: "stopped", stoppedAt: version(register) })
}

function undoRun(register: Register, runId: string): Decision {
  if ((register.phase !== "running" && register.phase !== "stopped") || register.runId !== runId) {
    return refuse("run-fenced")
  }
  const landed = register.landed.map((row) =>
    row.actor === "agent" ? { actor: "agent" as const, value: row.value, visible: false } : row,
  )
  return apply({ ...register, phase: "undone", landed })
}

export function decide(register: Register, command: Command): Decision {
  if (command.command === "person") {
    return personEdit(register, command.value)
  }
  if (command.command === "agent") {
    return agentEdit(register, command.runId, command.readAt, command.value)
  }
  if (command.command === "start") {
    return startRun(register, command.runId)
  }
  if (command.command === "stop") {
    return stopRun(register, command.runId)
  }
  return undoRun(register, command.runId)
}
