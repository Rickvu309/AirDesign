import { describe, expect, it } from "vitest"
import { decide, openRegister, version, type Command, type Phase, type Register, type Refusal } from "./decide.js"
import { copyRegister, freezeRegister, walkRegisters } from "./decide.walk.js"

type RunState = "match" | "miss"
type ReadState = "equal" | "stale"
type AgentState = "none" | "visible" | "hidden"
type EditCommand = "person" | "agent" | "start" | "stop" | "undo"

type Situation = {
  readonly command: EditCommand
  readonly phase: Phase
  readonly run: RunState
  readonly read: ReadState
  readonly guarded: boolean
  readonly agent: AgentState
}

type Clause = {
  readonly phase?: Phase | readonly Phase[]
  readonly run?: RunState
  readonly read?: ReadState
  readonly guarded?: boolean
  readonly agent?: AgentState
}

type Effect =
  | { readonly outcome: "refuse"; readonly code: Refusal }
  | { readonly outcome: "person"; readonly guarded: "set" | "keep" }
  | { readonly outcome: "start" }
  | { readonly outcome: "stop" }
  | { readonly outcome: "undo" }
  | { readonly outcome: "agent" }

type Rule = {
  readonly name: string
  readonly command: EditCommand
  readonly when?: Clause
  readonly unless?: readonly Clause[]
  readonly effect: Effect
}

function phaseMatches(expected: Phase | readonly Phase[] | undefined, actual: Phase): boolean {
  if (expected === undefined) {
    return true
  }
  if (typeof expected === "string") {
    return expected === actual
  }
  return expected.includes(actual)
}

function matchesClause(clause: Clause, picture: Situation): boolean {
  if (!phaseMatches(clause.phase, picture.phase)) {
    return false
  }
  if (clause.run !== undefined && clause.run !== picture.run) {
    return false
  }
  if (clause.read !== undefined && clause.read !== picture.read) {
    return false
  }
  if (clause.guarded !== undefined && clause.guarded !== picture.guarded) {
    return false
  }
  if (clause.agent !== undefined && clause.agent !== picture.agent) {
    return false
  }
  return true
}

function matches(rule: Rule, picture: Situation): boolean {
  if (rule.command !== picture.command) {
    return false
  }
  if (rule.when !== undefined && !matchesClause(rule.when, picture)) {
    return false
  }
  if (rule.unless !== undefined && rule.unless.some((clause) => matchesClause(clause, picture))) {
    return false
  }
  return true
}

function rulesOf(kind: Command["command"]): readonly Rule[] {
  switch (kind) {
    case "person":
      return [
        {
          name: "A person edit during a run with no agent row sets the guard",
          command: "person",
          when: { phase: "running", agent: "none" },
          effect: { outcome: "person", guarded: "set" },
        },
        {
          name: "A person edit keeps the guard after the agent has landed",
          command: "person",
          when: { phase: "running", agent: "visible" },
          effect: { outcome: "person", guarded: "keep" },
        },
        {
          name: "A person edit keeps the guard",
          command: "person",
          unless: [
            { phase: "running", agent: "none" },
            { phase: "running", agent: "visible" },
          ],
          effect: { outcome: "person", guarded: "keep" },
        },
      ]
    case "start":
      return [
        {
          name: "A start from idle opens the run",
          command: "start",
          when: { phase: "idle" },
          effect: { outcome: "start" },
        },
        {
          name: "A start outside idle stays fenced",
          command: "start",
          unless: [{ phase: "idle" }],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
      ]
    case "stop":
      return [
        {
          name: "A stop with the matching run id records stoppedAt",
          command: "stop",
          when: { phase: "running", run: "match" },
          effect: { outcome: "stop" },
        },
        {
          name: "A stop refuses a different run id",
          command: "stop",
          unless: [{ phase: "running", run: "match" }],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
      ]
    case "undo":
      return [
        {
          name: "An undo with the matching run id hides the agent row",
          command: "undo",
          when: { phase: ["running", "stopped"], run: "match" },
          effect: { outcome: "undo" },
        },
        {
          name: "An undo outside a live run stays fenced",
          command: "undo",
          unless: [{ phase: ["running", "stopped"], run: "match" }],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
      ]
    case "agent":
      return [
        {
          name: "An agent edit outside the running run stays fenced",
          command: "agent",
          unless: [{ phase: "running", run: "match" }],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "An agent edit with a stale read refuses stale",
          command: "agent",
          when: { phase: "running", run: "match", read: "stale" },
          effect: { outcome: "refuse", code: "stale" },
        },
        {
          name: "An agent edit of a guarded run refuses person-protected",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: true },
          effect: { outcome: "refuse", code: "person-protected" },
        },
        {
          name: "A second agent edit in one run stays fenced",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: false, agent: "visible" },
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "An agent edit lands one row and records claimed",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: false, agent: "none" },
          effect: { outcome: "agent" },
        },
      ]
    case "add":
    case "remove":
    case "read":
      return []
    default: {
      const unreachable: never = kind
      throw new Error(unreachable)
    }
  }
}

const rules: readonly Rule[] = [
  ...rulesOf("person"),
  ...rulesOf("agent"),
  ...rulesOf("start"),
  ...rulesOf("stop"),
  ...rulesOf("undo"),
]

function agentState(register: Register): AgentState {
  if (register.landed.some((row) => row.actor === "agent" && row.visible)) {
    return "visible"
  }
  if (register.landed.some((row) => row.actor === "agent")) {
    return "hidden"
  }
  return "none"
}

function runState(register: Register, runId: string): RunState {
  return register.runId === runId ? "match" : "miss"
}

function readState(readAt: number, register: Register): ReadState {
  return readAt === version(register) ? "equal" : "stale"
}

function situation(register: Register, command: Command): Situation | null {
  switch (command.command) {
    case "person":
      return {
        command: "person",
        phase: register.phase,
        run: "miss",
        read: "equal",
        guarded: register.guarded,
        agent: agentState(register),
      }
    case "agent":
      return {
        command: "agent",
        phase: register.phase,
        run: runState(register, command.runId),
        read: readState(command.readAt, register),
        guarded: register.guarded,
        agent: agentState(register),
      }
    case "start":
    case "stop":
    case "undo":
      return {
        command: command.command,
        phase: register.phase,
        run: runState(register, command.runId),
        read: "equal",
        guarded: register.guarded,
        agent: agentState(register),
      }
    case "add":
    case "remove":
    case "read":
      return null
    default: {
      const unreachable: never = command
      throw new Error(unreachable)
    }
  }
}

function commands(register: Register): readonly Command[] {
  const current = version(register)
  const below = current === 0 ? -1 : current - 1
  const list: Command[] = []
  const push = (command: Command): void => {
    switch (command.command) {
      case "person":
      case "agent":
      case "start":
      case "stop":
      case "undo":
        list.push(command)
        return
      case "add":
      case "remove":
      case "read":
        return
      default: {
        const unreachable: never = command
        throw new Error(unreachable)
      }
    }
  }
  for (const runId of ["r", "s"] as const) {
    push({ command: "start", runId })
  }
  for (const runId of ["r", "s"] as const) {
    push({ command: "stop", runId })
  }
  for (const runId of ["r", "s"] as const) {
    push({ command: "undo", runId })
  }
  push({ command: "person", value: "p" })
  for (const runId of ["r", "s"] as const) {
    push({ command: "agent", runId, readAt: below, value: "a" })
    push({ command: "agent", runId, readAt: current, value: "a" })
    push({ command: "agent", runId, readAt: current + 1, value: "a" })
  }
  return list
}

function visiblePeople(register: Register): number {
  let count = 0
  for (const row of register.landed) {
    if (row.actor === "person" && row.visible) {
      count += 1
    }
  }
  return count
}

function identity(register: Register): string {
  return JSON.stringify({
    phase: register.phase,
    runId: register.runId,
    readAt: register.readAt,
    guarded: register.guarded,
    claimed: register.claimed,
    stoppedAt: register.stoppedAt,
    landed: register.landed,
  })
}

function nextRegister(register: Register, command: Command, effect: Effect): Register {
  switch (effect.outcome) {
    case "refuse":
      throw new Error(effect.outcome)
    case "person": {
      if (command.command !== "person") {
        throw new Error(effect.outcome)
      }
      return {
        ...register,
        landed: [...register.landed, { actor: "person", value: command.value, visible: true }],
        guarded: effect.guarded === "set" ? true : register.guarded,
      }
    }
    case "start": {
      if (command.command !== "start") {
        throw new Error(effect.outcome)
      }
      return {
        ...register,
        phase: "running",
        runId: command.runId,
        readAt: version(register),
        guarded: false,
      }
    }
    case "stop":
      return { ...register, phase: "stopped", stoppedAt: version(register) }
    case "undo":
      return {
        ...register,
        phase: "undone",
        landed: register.landed.map((row) =>
          row.actor === "agent"
            ? { actor: "agent", value: row.value, visible: false }
            : { actor: row.actor, value: row.value, visible: row.visible },
        ),
      }
    case "agent": {
      if (command.command !== "agent") {
        throw new Error(effect.outcome)
      }
      return {
        ...register,
        landed: [...register.landed, { actor: "agent", value: command.value, visible: true }],
        claimed: command.readAt,
      }
    }
  }
}

type WalkHit = {
  hits: number
  failure: string | null
}

function sameText(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function walkOnce(): { readonly hits: ReadonlyMap<string, WalkHit>; readonly overlap: string | null } {
  const hits = new Map<string, WalkHit>(rules.map((rule) => [rule.name, { hits: 0, failure: null }]))
  let overlap: string | null = null
  walkRegisters({
    start: freezeRegister(openRegister("floor", "slide")),
    identity,
    commands,
    keep: (register) => visiblePeople(register) <= 2,
    cap: (dequeued, register) => {
      if (version(register) > 4 || dequeued > 400) {
        throw new Error("state cap hit")
      }
    },
    step: (register, command) => {
      const picture = situation(register, command)
      if (picture === null) {
        overlap = overlap ?? `${command.command} has no row`
        return null
      }
      const found = rulesOf(picture.command).filter((candidate) => matches(candidate, picture))
      const chosen = found[0]
      if (found.length !== 1 || chosen === undefined) {
        overlap = overlap ?? `${picture.command} matched ${String(found.length)} rows`
        return null
      }
      const hit = hits.get(chosen.name)
      if (hit === undefined) {
        throw new Error(chosen.name)
      }
      const before = copyRegister(register)
      const decision = decide(register, command)
      if (!sameText(register, before)) {
        hit.failure = hit.failure ?? `${chosen.name} changed the input`
        return null
      }
      const expected =
        chosen.effect.outcome === "refuse"
          ? { decision: "refuse" as const, code: chosen.effect.code }
          : {
              decision: "apply" as const,
              register: nextRegister(register, command, chosen.effect),
              route: register.route,
            }
      if (!sameText(decision, expected)) {
        hit.failure = hit.failure ?? `${chosen.name} disagreed`
        return null
      }
      hit.hits += 1
      return decision.decision === "apply" ? decision.register : null
    },
  })
  return { hits, overlap }
}

let walked: ReturnType<typeof walkOnce> | undefined

function walkAll(): ReturnType<typeof walkOnce> {
  walked ??= walkOnce()
  return walked
}

describe("decide", () => {
  for (const rule of rules) {
    it(rule.name, () => {
      let outcome: ReturnType<typeof walkOnce>
      try {
        outcome = walkAll()
      } catch (error) {
        const message = error instanceof Error ? error.message : "walk failed"
        throw new Error(`${rule.name} ${message}`)
      }
      if (outcome.overlap !== null) {
        throw new Error(`${rule.name} ${outcome.overlap}`)
      }
      const hit = outcome.hits.get(rule.name)
      if (hit === undefined) {
        throw new Error(rule.name)
      }
      if (hit.failure !== null) {
        throw new Error(hit.failure)
      }
      if (hit.hits === 0) {
        throw new Error(`${rule.name} was not reached`)
      }
    })
  }

  it("A person value is not trimmed", () => {
    const value = '  {"a":1}  \n\u0000café'
    const register = freezeRegister(openRegister("floor", "slide"))
    const before = copyRegister(register)
    const decision = decide(register, { command: "person", value })
    expect(register, "A person value is not trimmed").toEqual(before)
    expect(decision, "A person value is not trimmed").toEqual({
      decision: "apply",
      route: register.route,
      register: {
        ...register,
        landed: [...register.landed, { actor: "person", value, visible: true }],
      },
    })
  })
})
