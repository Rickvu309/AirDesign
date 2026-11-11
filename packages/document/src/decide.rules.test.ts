import { describe, expect, it } from "vitest"
import {
  decide,
  openRegister,
  history,
  version,
  type Command,
  type NodeRegister,
  type Phase,
  type Register,
  type Refusal,
} from "./decide.js"
import { elementId, rootElement, type ElementId } from "./element-id.js"
import { bodyFrom, copyRegister, freezeRegister, openedBody, walkRegisters, withOpened } from "./decide.walk.js"

type View = NodeRegister & { readonly nodes: readonly ElementId[]; readonly readNodes: readonly ElementId[] | null }

type RunState = "match" | "miss"
type ReadState = "equal" | "stale" | "claimed" | "interrupted"
type AgentState = "none" | "visible" | "hidden"
type NamedRows = "none" | "visible" | "hidden"
type PriorRows = "none" | "some"
type EditCommand = "person" | "agent" | "start" | "stop" | "undo" | "read"

type Situation = {
  readonly command: EditCommand
  readonly phase: Phase
  readonly run: RunState
  readonly read: ReadState
  readonly guarded: boolean
  readonly agent: AgentState
  readonly named: NamedRows
  readonly prior: PriorRows
}

type Clause = {
  readonly phase?: Phase | readonly Phase[]
  readonly run?: RunState
  readonly read?: ReadState
  readonly guarded?: boolean
  readonly agent?: AgentState
  readonly named?: NamedRows | readonly NamedRows[]
  readonly prior?: PriorRows
}

type Effect =
  | { readonly outcome: "refuse"; readonly code: Refusal }
  | { readonly outcome: "person"; readonly guarded: "set" | "keep" }
  | { readonly outcome: "start" }
  | { readonly outcome: "stop" }
  | { readonly outcome: "undo" }
  | { readonly outcome: "undo-run" }
  | { readonly outcome: "agent" }
  | { readonly outcome: "read" }

type Rule = {
  readonly name: string
  readonly command: EditCommand
  readonly runId?: string
  readonly when?: Clause
  readonly unless?: readonly Clause[]
  readonly effect: Effect
}

function freshRun(): string {
  const id = `run${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  if (id.length < 2) {
    throw new Error("run id")
  }
  return id
}

const storedRun = freshRun()
const otherRun = `${storedRun}-other`

function phaseMatches(expected: Phase | readonly Phase[] | undefined, actual: Phase): boolean {
  if (expected === undefined) {
    return true
  }
  if (typeof expected === "string") {
    return expected === actual
  }
  return expected.includes(actual)
}

function namedMatches(expected: NamedRows | readonly NamedRows[] | undefined, actual: NamedRows): boolean {
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
  if (!namedMatches(clause.named, picture.named)) {
    return false
  }
  if (clause.prior !== undefined && clause.prior !== picture.prior) {
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
          name: "A person edit after the agent has landed sets the guard",
          command: "person",
          when: { phase: "running", agent: "visible", prior: "none" },
          effect: { outcome: "person", guarded: "set" },
        },
        {
          name: "A person edit during a second run before it lands sets the guard",
          command: "person",
          when: { phase: "running", named: "none", prior: "some" },
          effect: { outcome: "person", guarded: "set" },
        },
        {
          name: "A person edit during a second run after it lands sets the guard",
          command: "person",
          when: { phase: "running", named: "visible", prior: "some" },
          effect: { outcome: "person", guarded: "set" },
        },
        {
          name: "A person edit keeps the guard",
          command: "person",
          unless: [
            { phase: "running", agent: "none" },
            { phase: "running", agent: "visible", prior: "none" },
            { phase: "running", named: "none", prior: "some" },
            { phase: "running", named: "visible", prior: "some" },
          ],
          effect: { outcome: "person", guarded: "keep" },
        },
      ]
    case "start":
      return [
        {
          name: "A start from idle opens the run",
          command: "start",
          when: { phase: "idle", named: "none" },
          effect: { outcome: "start" },
        },
        {
          name: "A start from stopped opens a new run",
          command: "start",
          when: { phase: "stopped", named: "none" },
          effect: { outcome: "start" },
        },
        {
          name: "A start from undone opens a new run",
          command: "start",
          when: { phase: "undone", named: "none" },
          effect: { outcome: "start" },
        },
        {
          name: "A start from a running run stays fenced",
          command: "start",
          when: { phase: "running" },
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "A start that reuses an id with rows stays fenced",
          command: "start",
          when: { phase: ["idle", "stopped", "undone"], named: ["visible", "hidden"] },
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
          name: "An undo of the current run hides only that run's rows",
          command: "undo",
          when: { phase: ["running", "stopped"], run: "match", named: ["none", "visible"] },
          effect: { outcome: "undo" },
        },
        {
          name: "An undo of an earlier run hides only that run's rows",
          command: "undo",
          when: { phase: ["stopped", "undone"], run: "miss", named: "visible" },
          effect: { outcome: "undo-run" },
        },
        {
          name: "An undo of an earlier run stays fenced while a run is live",
          command: "undo",
          when: { phase: "running", run: "miss", named: "visible" },
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "An undo outside a live run stays fenced",
          command: "undo",
          unless: [
            { phase: ["running", "stopped"], run: "match", named: ["none", "visible"] },
            { phase: ["stopped", "undone"], run: "miss", named: "visible" },
            { phase: "running", run: "miss", named: "visible" },
          ],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
      ]
    case "agent":
      return [
        {
          name: "An edit from an ended run stays fenced",
          command: "agent",
          when: { phase: "running", run: "miss", named: ["visible", "hidden"] },
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "An agent edit outside the running run stays fenced",
          command: "agent",
          unless: [
            { phase: "running", run: "match" },
            { phase: "running", run: "miss", named: ["visible", "hidden"] },
          ],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "An agent edit with a stale read on an unguarded run refuses stale",
          command: "agent",
          when: { phase: "running", run: "match", read: "stale", guarded: false },
          effect: { outcome: "refuse", code: "stale" },
        },
        {
          name: "An agent edit with a stale read on a guarded run refuses person-protected",
          command: "agent",
          when: { phase: "running", run: "match", read: "stale", guarded: true },
          effect: { outcome: "refuse", code: "person-protected" },
        },
        {
          name: "A fresh read after a person row in the run refuses person-protected",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: true, agent: "visible" },
          effect: { outcome: "refuse", code: "person-protected" },
        },
        {
          name: "An agent edit of a guarded run refuses person-protected",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: true },
          unless: [{ agent: "visible" }],
          effect: { outcome: "refuse", code: "person-protected" },
        },
        {
          name: "A fresh read lands another agent row in the same run",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: false, named: "visible" },
          effect: { outcome: "agent" },
        },
        {
          name: "An agent edit of a second run lands",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: false, named: "none", prior: "some" },
          effect: { outcome: "agent" },
        },
        {
          name: "A later change of the same run with the claimed read lands",
          command: "agent",
          when: { phase: "running", run: "match", read: "claimed", guarded: false },
          effect: { outcome: "agent" },
        },
        {
          name: "A claimed read after a person row refuses person-protected",
          command: "agent",
          when: { phase: "running", run: "match", read: "interrupted" },
          effect: { outcome: "refuse", code: "person-protected" },
        },
        {
          name: "An agent edit lands one row and records claimed",
          command: "agent",
          when: { phase: "running", run: "match", read: "equal", guarded: false, agent: "none", prior: "none" },
          effect: { outcome: "agent" },
        },
      ]
    case "add":
    case "remove":
      return []
    case "read":
      return [
        {
          name: "A read with the stored run id stores the nodes",
          command: "read",
          runId: storedRun,
          when: { phase: ["stopped", "undone"], run: "match" },
          effect: { outcome: "read" },
        },
        {
          name: "A read with a different run id stays fenced",
          command: "read",
          runId: otherRun,
          when: { phase: ["stopped", "undone"], run: "miss" },
          effect: { outcome: "refuse", code: "run-fenced" },
        },
        {
          name: "A read outside a stopped run stays fenced",
          command: "read",
          runId: storedRun,
          unless: [{ phase: ["stopped", "undone"] }],
          effect: { outcome: "refuse", code: "run-fenced" },
        },
      ]
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
  ...rulesOf("read"),
]

function agentState(register: View): AgentState {
  if (register.landed.some((row) => row.actor === "agent" && row.visible)) {
    return "visible"
  }
  if (register.landed.some((row) => row.actor === "agent")) {
    return "hidden"
  }
  return "none"
}

function runState(register: View, runId: string): RunState {
  return register.runId === runId ? "match" : "miss"
}

function namedRows(register: View, runId: string | null): { named: NamedRows; prior: PriorRows } {
  let named: NamedRows = "none"
  let prior: PriorRows = "none"
  for (const row of register.landed) {
    if (row.actor !== "agent" || row.runId === undefined) continue
    if (row.runId === runId) {
      if (row.visible) named = "visible"
      else if (named !== "visible") named = "hidden"
    } else {
      prior = "some"
    }
  }
  return { named, prior }
}

function readState(readAt: number, register: View): ReadState {
  if (readAt === version(register)) {
    return "equal"
  }
  if (
    register.claimed !== null &&
    readAt === register.claimed &&
    register.landed.some((row) => row.actor === "agent")
  ) {
    const after = register.landed.slice(register.claimed + 1)
    if (after.every((row) => row.actor === "agent")) {
      return "claimed"
    }
    return "interrupted"
  }
  return "stale"
}

function situation(register: View, command: Command): Situation | null {
  switch (command.command) {
    case "person":
      return {
        command: "person",
        phase: register.phase,
        run: "miss",
        read: "equal",
        guarded: register.guarded,
        agent: agentState(register),
        ...namedRows(register, register.runId),
      }
    case "agent":
      return {
        command: "agent",
        phase: register.phase,
        run: runState(register, command.runId),
        read: readState(command.readAt, register),
        guarded: register.guarded,
        agent: agentState(register),
        ...namedRows(register, command.runId),
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
        ...namedRows(register, command.runId),
      }
    case "add":
    case "remove":
      return null
    case "read":
      return {
        command: "read",
        phase: register.phase,
        run: runState(register, command.runId),
        read: "equal",
        guarded: register.guarded,
        agent: agentState(register),
        ...namedRows(register, command.runId),
      }
    default: {
      const unreachable: never = command
      throw new Error(unreachable)
    }
  }
}

function commands(register: View): readonly Command[] {
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
        return
      case "read":
        list.push(command)
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
    const readAt = [below, current, current + 1]
    if (register.claimed !== null && !readAt.includes(register.claimed)) {
      readAt.push(register.claimed)
    }
    for (const at of readAt) {
      push({ command: "agent", runId, readAt: at, value: "a" })
    }
  }
  const readIds: string[] = []
  for (const rule of rulesOf("read")) {
    if (rule.runId === undefined) {
      throw new Error(rule.name)
    }
    if (!readIds.includes(rule.runId)) {
      readIds.push(rule.runId)
    }
  }
  const stored = readIds.find((id) => id === storedRun)
  if (stored === undefined) {
    throw new Error("read")
  }
  push({ command: "start", runId: stored })
  push({ command: "stop", runId: stored })
  push({ command: "undo", runId: stored })
  for (const runId of readIds) {
    push({ command: "read", runId, node: rootElement })
  }
  return list
}

function visiblePeople(register: View): number {
  let count = 0
  for (const row of register.landed) {
    if (row.actor === "person" && row.visible) {
      count += 1
    }
  }
  return count
}

function visibleAgents(register: View): number {
  let count = 0
  for (const row of register.landed) {
    if (row.actor === "agent" && row.visible) {
      count += 1
    }
  }
  return count
}

function agentRows(register: View): number {
  let count = 0
  for (const row of register.landed) {
    if (row.actor === "agent") {
      count += 1
    }
  }
  return count
}

function runIds(register: View): number {
  return runIdSet(register).size
}

function runIdSet(register: View): Set<string> {
  const ids = new Set<string>()
  if (register.runId !== null) ids.add(register.runId)
  for (const row of register.landed) {
    if (row.actor === "agent" && row.runId !== undefined) ids.add(row.runId)
  }
  return ids
}

function usesStoredRun(register: View): boolean {
  return runIdSet(register).has(storedRun)
}

function usesPairRun(register: View): boolean {
  const ids = runIdSet(register)
  return ids.has("r") || ids.has("s")
}

function keepRegister(register: View): boolean {
  if (visiblePeople(register) > 2 || visibleAgents(register) > 2) {
    return false
  }
  if (agentRows(register) > 2 || runIds(register) > 2) {
    return false
  }
  if (usesStoredRun(register) && usesPairRun(register)) {
    return false
  }
  if (runIds(register) < 2) {
    return true
  }
  return (
    visiblePeople(register) === 0 && history(register).length <= 2 && !register.guarded && register.phase !== "undone"
  )
}

function identity(register: View): string {
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

function nextRegister(register: View, command: Command, effect: Effect): View {
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
        version: version(register) + 1,
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
        claimed: null,
        stoppedAt: null,
      }
    }
    case "stop":
      return { ...register, phase: "stopped", stoppedAt: version(register) }
    case "undo":
    case "undo-run": {
      if (command.command !== "undo") {
        throw new Error(effect.outcome)
      }
      const landed = register.landed.map((row) =>
        row.actor === "agent" && row.runId === command.runId ? { ...row, visible: false } : row,
      )
      const hidden = register.landed.filter((row) => row.visible && row.runId === command.runId).length
      if (effect.outcome === "undo-run") {
        return { ...register, landed, version: version(register) + hidden }
      }
      return { ...register, phase: "undone", landed, version: version(register) + hidden }
    }
    case "agent": {
      if (command.command !== "agent") {
        throw new Error(effect.outcome)
      }
      return {
        ...register,
        landed: [...register.landed, { actor: "agent", value: command.value, visible: true, runId: command.runId }],
        version: version(register) + 1,
        claimed: command.readAt,
      }
    }
    case "read":
      return { ...register, readNodes: [...register.nodes] }
  }
}

type WalkHit = {
  hits: number
  failure: string | null
}

function sameText(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function bodyOf(register: Register, target: ElementId | null): NodeRegister {
  const source = register.elements[target ?? rootElement]
  if (source === undefined) throw new Error("missing element")
  return bodyFrom(source)
}

function viewOf(register: Register, target: ElementId | null): View {
  return { ...bodyOf(register, target), nodes: register.nodes, readNodes: register.readNodes }
}

function writtenBack(register: Register, view: View, target: ElementId | null): Register {
  return {
    ...register,
    readNodes: view.readNodes,
    elements: { ...register.elements, [target ?? rootElement]: bodyFrom(view) },
  }
}

function walkStart(target: ElementId | null): Register {
  const opened = openRegister("floor", "slide")
  if (target === null) return freezeRegister(opened)
  const added = decide(opened, { command: "add", node: target, floor: "floor", route: "part" })
  if (added.decision !== "apply") throw new Error("add")
  return freezeRegister(added.register)
}

function aimedAt(command: Command, target: ElementId | null): Command {
  if (target === null || command.command === "add") return command
  return { ...command, node: target }
}

function walkOnce(target: ElementId | null): {
  readonly hits: ReadonlyMap<string, WalkHit>
  readonly overlap: string | null
} {
  const hits = new Map<string, WalkHit>(rules.map((rule) => [rule.name, { hits: 0, failure: null }]))
  let overlap: string | null = null
  walkRegisters({
    start: walkStart(target),
    identity: (register) => identity(viewOf(register, target)),
    commands: (register) => commands(viewOf(register, target)).map((command) => aimedAt(command, target)),
    keep: (register) => keepRegister(viewOf(register, target)),
    cap: (dequeued, register) => {
      if (history(viewOf(register, target)).length > 4 || dequeued > 400) {
        throw new Error("state cap hit")
      }
    },
    step: (register, command) => {
      const view = viewOf(register, target)
      const picture = situation(view, command)
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
              register: writtenBack(register, nextRegister(view, command, chosen.effect), target),
              route: view.route,
            }
      if (!sameText(decision, expected)) {
        hit.failure = hit.failure ?? `${chosen.name} disagreed`
        return expected.decision === "apply" ? expected.register : null
      }
      hit.hits += 1
      return decision.decision === "apply" ? decision.register : null
    },
  })
  return { hits, overlap }
}

let walked: ReturnType<typeof walkOnce> | undefined

function walkAll(): ReturnType<typeof walkOnce> {
  walked ??= walkOnce(null)
  return walked
}

function setsGuardAfterAgent(name: string): void {
  const register = freezeRegister(
    withOpened(openRegister("floor", "slide"), {
      phase: "running",
      runId: "r",
      readAt: 1,
      guarded: false,
      landed: [{ actor: "agent", value: "wrote", visible: true }],
    }),
  )
  const before = copyRegister(register)
  const decision = decide(register, { command: "person", value: "kept" })
  expect(register, name).toEqual(before)
  expect(decision, name).toEqual({
    decision: "apply",
    route: openedBody(register).route,
    register: withOpened(register, {
      landed: [...openedBody(register).landed, { actor: "person", value: "kept", visible: true }],
      version: 2,
      guarded: true,
    }),
  })
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
      expect(hit.hits, `${rule.name} was not reached`).toBeGreaterThan(0)
      if (rule.name === "A person edit after the agent has landed sets the guard") {
        setsGuardAfterAgent(rule.name)
      }
      if (
        rule.name === "A fresh read lands another agent row in the same run" ||
        rule.name === "A later change of the same run with the claimed read lands" ||
        rule.name === "A claimed read after a person row refuses person-protected" ||
        rule.name === "A fresh read after a person row in the run refuses person-protected" ||
        rule.name === "A person edit during a second run before it lands sets the guard" ||
        rule.name === "A person edit during a second run after it lands sets the guard" ||
        rule.name === "A start from stopped opens a new run" ||
        rule.name === "A start from undone opens a new run" ||
        rule.name === "A start that reuses an id with rows stays fenced" ||
        rule.name === "A start from a running run stays fenced" ||
        rule.name === "An undo of the current run hides only that run's rows" ||
        rule.name === "An undo of an earlier run hides only that run's rows" ||
        rule.name === "An undo of an earlier run stays fenced while a run is live" ||
        rule.name === "An edit from an ended run stays fenced" ||
        rule.name === "An agent edit of a second run lands"
      ) {
        expect(hit.hits, rule.name).toBeGreaterThan(0)
      }
    })
  }

  it("holds every rule for a map element", () => {
    for (const target of [elementId("258.7"), "__proto__" as ElementId]) {
      const outcome = walkOnce(target)
      expect(outcome.overlap, target).toBeNull()
      for (const rule of rules) {
        const hit = outcome.hits.get(rule.name)
        expect(hit?.failure ?? null, `${target} ${rule.name}`).toBeNull()
        expect(hit?.hits ?? 0, `${target} ${rule.name}`).toBeGreaterThan(0)
      }
    }
  })

  it("An undo hides both rows of one run", () => {
    const register = freezeRegister(
      withOpened(openRegister("floor", "slide"), {
        phase: "running",
        runId: "run",
        readAt: 0,
        claimed: 0,
        landed: [
          { actor: "agent", value: "one", visible: true, runId: "run" },
          { actor: "agent", value: "two", visible: true, runId: "run" },
        ],
      }),
    )
    const before = copyRegister(register)
    const decision = decide(register, { command: "undo", runId: "run" })
    expect(register).toEqual(before)
    expect(decision).toEqual({
      decision: "apply",
      route: openedBody(register).route,
      register: withOpened(register, {
        phase: "undone",
        version: 4,
        landed: [
          { actor: "agent", value: "one", visible: false, runId: "run" },
          { actor: "agent", value: "two", visible: false, runId: "run" },
        ],
      }),
    })
  })

  it("An undo of a run whose rows are already hidden stays fenced", () => {
    const register = freezeRegister(
      withOpened(openRegister("floor", "slide"), {
        phase: "stopped",
        runId: "run",
        landed: [{ actor: "agent", value: "one", visible: false, runId: "run" }],
      }),
    )
    const before = copyRegister(register)
    expect(decide(register, { command: "undo", runId: "run" })).toEqual({ decision: "refuse", code: "run-fenced" })
    expect(register).toEqual(before)
  })

  it("A read equal to an undone run's claim is stale for the next run", () => {
    let register = openRegister("floor", "slide")
    const person = decide(register, { command: "person", value: "p" })
    expect(person.decision).toBe("apply")
    if (person.decision !== "apply") return
    register = person.register
    const started = decide(register, { command: "start", runId: "first" })
    expect(started.decision).toBe("apply")
    if (started.decision !== "apply") return
    register = started.register
    const claim = version(openedBody(register))
    const wrote = decide(register, { command: "agent", runId: "first", readAt: claim, value: "one" })
    expect(wrote.decision).toBe("apply")
    if (wrote.decision !== "apply") return
    register = wrote.register
    const during = decide(register, { command: "person", value: "q" })
    expect(during.decision).toBe("apply")
    if (during.decision !== "apply") return
    register = during.register
    const undone = decide(register, { command: "undo", runId: "first" })
    expect(undone.decision).toBe("apply")
    if (undone.decision !== "apply") return
    register = undone.register
    const next = decide(register, { command: "start", runId: "second" })
    expect(next.decision).toBe("apply")
    if (next.decision !== "apply") return
    register = next.register
    expect(openedBody(register).claimed).toBeNull()
    expect(openedBody(register).guarded).toBe(false)
    expect(decide(register, { command: "agent", runId: "second", readAt: claim, value: "old" })).toEqual({
      decision: "refuse",
      code: "stale",
    })
    const read = version(openedBody(register))
    const firstRow = decide(register, { command: "agent", runId: "second", readAt: read, value: "two" })
    expect(firstRow.decision).toBe("apply")
    if (firstRow.decision !== "apply") return
    const secondRow = decide(firstRow.register, {
      command: "agent",
      runId: "second",
      readAt: read,
      value: "three",
    })
    expect(secondRow.decision).toBe("apply")
    if (secondRow.decision !== "apply") return
    expect(openedBody(secondRow.register).claimed).toBe(read)
    expect(
      openedBody(secondRow.register).landed.filter(
        (row) => row.actor === "agent" && row.visible && row.runId === "second",
      ),
    ).toEqual([
      { actor: "agent", value: "two", visible: true, runId: "second" },
      { actor: "agent", value: "three", visible: true, runId: "second" },
    ])
  })

  it("A person value is not trimmed", () => {
    const value = '  {"a":1}  \n\u0000café'
    const register = freezeRegister(openRegister("floor", "slide"))
    const before = copyRegister(register)
    const decision = decide(register, { command: "person", value })
    expect(register, "A person value is not trimmed").toEqual(before)
    expect(decision, "A person value is not trimmed").toEqual({
      decision: "apply",
      route: openedBody(register).route,
      register: withOpened(register, {
        version: 1,
        landed: [...openedBody(register).landed, { actor: "person", value, visible: true }],
      }),
    })
  })
})
