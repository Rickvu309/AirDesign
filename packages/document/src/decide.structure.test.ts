import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  openRegister,
  version,
  type Command,
  type Decision,
  type NodeRegister,
  type Phase,
  type Register,
  type Refusal,
} from "./decide.js"
import { legacyElement, rootElement, type ElementId } from "./element-id.js"
import { copyRegister, freezeRegister, openedBody, walkRegisters } from "./decide.walk.js"

type Effect = "add" | "remove" | "read"

type StructureRule = {
  readonly command: "add" | "remove" | "person" | "agent" | "start" | "stop" | "read"
  readonly present: boolean
  readonly phase?: Phase
  readonly outcome: "apply" | "refuse"
  readonly effect?: Effect
  readonly code?: Refusal
  readonly runId?: string
}

function freshRun(): string {
  const id = `run${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  if (id.length < 2) {
    throw new Error("run id")
  }
  return id
}

const storedRun = freshRun()

const rules: readonly StructureRule[] = [
  { command: "add", present: false, outcome: "apply", effect: "add" },
  { command: "add", present: true, outcome: "refuse", code: "present" },
  { command: "remove", present: false, outcome: "refuse", code: "dead" },
  { command: "remove", present: true, outcome: "apply", effect: "remove" },
  { command: "person", present: false, outcome: "refuse", code: "dead" },
  { command: "agent", present: false, outcome: "refuse", code: "dead" },
  { command: "agent", present: true, phase: "idle", outcome: "refuse", code: "run-fenced" },
  { command: "start", present: false, outcome: "refuse", code: "dead" },
  { command: "stop", present: false, outcome: "refuse", code: "dead" },
  { command: "read", present: false, outcome: "refuse", code: "dead" },
  { command: "read", present: true, phase: "idle", outcome: "refuse", code: "run-fenced" },
  { command: "read", present: true, phase: "running", outcome: "refuse", code: "run-fenced" },
  { command: "read", present: true, phase: "stopped", outcome: "apply", effect: "read", runId: storedRun },
]

const table = new Map<string, StructureRule>()

function rowKey(rule: StructureRule): string {
  if (rule.phase === undefined) {
    return JSON.stringify({ command: rule.command, present: rule.present })
  }
  return JSON.stringify({ command: rule.command, present: rule.present, phase: rule.phase })
}

for (const rule of rules) {
  const key = rowKey(rule)
  if (table.has(key)) {
    throw new Error(`duplicate row ${key}`)
  }
  table.set(key, rule)
}

const opened = rootElement
const paired = legacyElement

function names(hasA: boolean, hasB: boolean): ElementId[] {
  const nodes: ElementId[] = []
  if (hasA) {
    nodes.push(opened)
  }
  if (hasB) {
    nodes.push(paired)
  }
  return nodes
}

function targetOf(command: Command): ElementId {
  if (command.command === "add") return command.node
  if (command.command === "slide") return opened
  return command.node ?? opened
}

function second(register: Register): NodeRegister | null {
  return register.elements[paired] ?? null
}

function bodyOf(register: Register, node: ElementId): NodeRegister | null {
  if (node === opened) {
    return openedBody(register)
  }
  return second(register)
}

function situationKey(register: Register, command: Command): string {
  const node = targetOf(command)
  const present = register.nodes.includes(node)
  if (command.command === "add" || command.command === "remove" || !present) {
    return JSON.stringify({ command: command.command, present })
  }
  const body = bodyOf(register, node)
  if (body === null) {
    throw new Error("missing node")
  }
  return JSON.stringify({ command: command.command, present: true, phase: body.phase })
}

function readRun(): string {
  const found = rules.find((rule) => rule.effect === "read")
  if (found?.runId === undefined) {
    throw new Error("read")
  }
  return found.runId
}

function commands(): readonly Command[] {
  const runId = readRun()
  return [
    { command: "add", node: paired, floor: "floor", route: "slide" },
    { command: "remove", node: paired },
    { command: "person", value: "p" },
    { command: "person", node: paired, value: "p" },
    { command: "agent", node: paired, runId: "s", readAt: 0, value: "a" },
    { command: "start", runId },
    { command: "stop", runId },
    { command: "read", runId, node: opened },
  ]
}

function visiblePeople(node: NodeRegister): number {
  let count = 0
  for (const row of node.landed) {
    if (row.actor === "person" && row.visible) {
      count += 1
    }
  }
  return count
}

function tooManyPeople(register: Register): boolean {
  if (visiblePeople(openedBody(register)) > 1) {
    return true
  }
  const other = second(register)
  return other !== null && visiblePeople(other) > 1
}

function expectBody(
  actual: NodeRegister,
  expected: { readonly version: number; readonly value: string; readonly phase: Phase; readonly guarded: boolean },
  key: string,
): void {
  expect(version(actual), key).toBe(expected.version)
  expect(currentValue(actual), key).toBe(expected.value)
  expect(actual.phase, key).toBe(expected.phase)
  expect(actual.guarded, key).toBe(expected.guarded)
}

function unchangedBody(actual: NodeRegister, before: NodeRegister, key: string): void {
  expectBody(
    actual,
    {
      version: version(before),
      value: currentValue(before),
      phase: before.phase,
      guarded: before.guarded,
    },
    key,
  )
}

function expectNodes(before: Register, after: Register, command: Command, effect: Effect, key: string): void {
  if (effect === "add") {
    expect(after.nodes, key).toEqual(names(before.nodes.includes(opened), true))
    return
  }
  if (effect === "remove") {
    const node = targetOf(command)
    expect(after.nodes, key).toEqual(
      names(
        node === opened ? false : before.nodes.includes(opened),
        node === paired ? false : before.nodes.includes(paired),
      ),
    )
    return
  }
  expect(after.nodes, key).toEqual(before.nodes)
}

function expectRead(before: Register, after: Register, effect: Effect, key: string): void {
  if (effect === "read") {
    expect(after.readNodes, key).toEqual([...before.nodes])
    return
  }
  expect(after.readNodes, key).toEqual(before.readNodes)
}

function expectTarget(before: Register, after: Register, command: Command, rule: StructureRule, key: string): void {
  const effect = rule.effect
  if (effect === undefined) {
    throw new Error(`missing effect ${key}`)
  }
  const node = targetOf(command)
  if (effect === "add") {
    const afterBody = second(after)
    const beforeBody = second(before)
    if (afterBody === null) {
      throw new Error(`missing b ${key}`)
    }
    if (beforeBody === null) {
      expectBody(afterBody, { version: 0, value: before.floor, phase: "idle", guarded: false }, key)
    } else {
      unchangedBody(afterBody, beforeBody, key)
    }
    unchangedBody(openedBody(after), openedBody(before), key)
    return
  }
  const beforeBody = bodyOf(before, node)
  const afterBody = bodyOf(after, node)
  if (beforeBody === null || afterBody === null) {
    throw new Error(`missing body ${key}`)
  }
  if (effect === "remove" || effect === "read") {
    unchangedBody(afterBody, beforeBody, key)
    return
  }
  const unreachable: never = effect
  throw new Error(unreachable)
}

function sameIds(left: readonly ElementId[] | null, right: readonly ElementId[] | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  if (left.length !== right.length) {
    return false
  }
  return left.every((name, index) => name === right[index])
}

function noteVisit(register: Register, command: Command, decision: Decision, seen: Set<string>): void {
  if (command.command === "add" && decision.decision === "apply" && decision.register.nodes.includes(paired)) {
    seen.add("Add b. b is present.")
  }
  if (command.command === "add" && decision.decision === "refuse" && decision.code === "present") {
    seen.add("Add b again. Refuse present.")
  }
  if (
    command.command === "agent" &&
    command.node === paired &&
    decision.decision === "refuse" &&
    decision.code === "dead" &&
    second(register) !== null &&
    !register.nodes.includes(paired)
  ) {
    seen.add("Remove b. An agent edit of b refuses dead.")
  }
  if (
    command.command === "remove" &&
    command.node === paired &&
    !register.nodes.includes(paired) &&
    decision.decision === "refuse" &&
    decision.code === "dead"
  ) {
    seen.add("Remove absent b. Refuse dead.")
  }
  if (
    (command.command === "add" || command.command === "remove") &&
    decision.decision === "apply" &&
    openedBody(register).phase === "stopped" &&
    register.readNodes !== null &&
    sameIds(register.readNodes, register.nodes) &&
    sameIds(decision.register.readNodes, register.readNodes) &&
    !sameIds(decision.register.nodes, register.nodes)
  ) {
    seen.add("Stop a, then read the stored run. readNodes stays after a later structure step.")
  }
  if (command.command === "read" && decision.decision === "refuse" && decision.code === "run-fenced") {
    const body = bodyOf(register, command.node)
    if (body !== null && body.phase === "idle") {
      seen.add("read from idle refuses run-fenced.")
    }
  }
}

function identity(register: Register): string {
  const node = (body: NodeRegister | null) =>
    body === null
      ? null
      : {
          landed: body.landed,
          phase: body.phase,
          runId: body.runId,
          guarded: body.guarded,
        }
  return JSON.stringify({
    nodes: register.nodes,
    readNodes: register.readNodes,
    a: node(openedBody(register)),
    b: node(second(register)),
  })
}

function checkCommand(register: Register, command: Command, seen: Set<string>): Register | null {
  const key = situationKey(register, command)
  const before = copyRegister(register)
  const decision = decide(register, command)
  expect(register, key).toEqual(before)
  const rule = table.get(key)
  if (rule === undefined) {
    if (command.command === "person" || command.command === "start" || command.command === "stop") {
      return decision.decision === "apply" ? decision.register : null
    }
    throw new Error(`missing row ${key}`)
  }
  if (rule.outcome === "refuse") {
    if (rule.code === undefined) {
      throw new Error(`missing code ${key}`)
    }
    expect(decision, key).toEqual({ decision: "refuse", code: rule.code })
    noteVisit(register, command, decision, seen)
    return null
  }
  expect(decision.decision, key).toBe("apply")
  if (decision.decision !== "apply") {
    throw new Error(`expected apply ${key}`)
  }
  if (rule.effect === undefined) {
    throw new Error(`missing effect ${key}`)
  }
  expect(decision.route, key).toBe(register.route)
  expectNodes(register, decision.register, command, rule.effect, key)
  expectRead(register, decision.register, rule.effect, key)
  expectTarget(register, decision.register, command, rule, key)
  noteVisit(register, command, decision, seen)
  return decision.register
}

const required = [
  "Add b. b is present.",
  "Add b again. Refuse present.",
  "Remove b. An agent edit of b refuses dead.",
  "Remove absent b. Refuse dead.",
  "Stop a, then read the stored run. readNodes stays after a later structure step.",
  "read from idle refuses run-fenced.",
]

function walk(): void {
  const seen = new Set<string>()
  walkRegisters({
    start: freezeRegister(openRegister("floor", "slide")),
    identity,
    commands: () => commands(),
    keep: (register) =>
      !tooManyPeople(register) && !(openedBody(register).phase === "running" && register.readNodes !== null),
    cap: (dequeued) => {
      if (dequeued > 80) {
        throw new Error("state cap hit")
      }
    },
    step: (register, command) => checkCommand(register, command, seen),
  })
  for (const name of required) {
    if (!seen.has(name)) {
      throw new Error(`not visited: ${name}`)
    }
  }
}

describe("structure", () => {
  it("walks add, remove, and the second read", () => {
    walk()
  })
})
