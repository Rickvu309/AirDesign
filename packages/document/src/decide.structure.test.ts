import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  openRegister,
  version,
  type Command,
  type Decision,
  type NodeName,
  type NodeRegister,
  type Phase,
  type Register,
  type Refusal,
} from "./decide.js"

type Effect = "add" | "remove" | "person" | "start" | "stop" | "read"

type StructureRule = {
  readonly command: "add" | "remove" | "person" | "agent" | "start" | "stop" | "read"
  readonly present: boolean
  readonly phase?: Phase
  readonly guarded?: boolean
  readonly outcome: "apply" | "refuse"
  readonly effect?: Effect
  readonly guardedNext?: boolean
  readonly code?: Refusal
}

const rules: readonly StructureRule[] = [
  { command: "add", present: false, outcome: "apply", effect: "add" },
  { command: "add", present: true, outcome: "refuse", code: "present" },
  { command: "remove", present: false, outcome: "refuse", code: "dead" },
  { command: "remove", present: true, outcome: "apply", effect: "remove" },
  { command: "person", present: false, outcome: "refuse", code: "dead" },
  {
    command: "person",
    present: true,
    phase: "idle",
    guarded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    present: true,
    phase: "running",
    guarded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    present: true,
    phase: "running",
    guarded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  {
    command: "person",
    present: true,
    phase: "stopped",
    guarded: false,
    outcome: "apply",
    effect: "person",
    guardedNext: false,
  },
  {
    command: "person",
    present: true,
    phase: "stopped",
    guarded: true,
    outcome: "apply",
    effect: "person",
    guardedNext: true,
  },
  { command: "agent", present: false, outcome: "refuse", code: "dead" },
  { command: "agent", present: true, phase: "idle", outcome: "refuse", code: "run-fenced" },
  { command: "start", present: false, outcome: "refuse", code: "dead" },
  { command: "start", present: true, phase: "idle", outcome: "apply", effect: "start" },
  { command: "start", present: true, phase: "running", outcome: "refuse", code: "run-fenced" },
  { command: "start", present: true, phase: "stopped", outcome: "refuse", code: "run-fenced" },
  { command: "stop", present: false, outcome: "refuse", code: "dead" },
  { command: "stop", present: true, phase: "idle", outcome: "refuse", code: "run-fenced" },
  { command: "stop", present: true, phase: "running", outcome: "apply", effect: "stop" },
  { command: "stop", present: true, phase: "stopped", outcome: "refuse", code: "run-fenced" },
  { command: "read", present: false, outcome: "refuse", code: "dead" },
  { command: "read", present: true, phase: "idle", outcome: "refuse", code: "run-fenced" },
  { command: "read", present: true, phase: "running", outcome: "refuse", code: "run-fenced" },
  { command: "read", present: true, phase: "stopped", outcome: "apply", effect: "read" },
]

const table = new Map<string, StructureRule>()

function rowKey(rule: StructureRule): string {
  if (rule.phase === undefined) {
    return JSON.stringify({ command: rule.command, present: rule.present })
  }
  if (rule.guarded === undefined) {
    return JSON.stringify({ command: rule.command, present: rule.present, phase: rule.phase })
  }
  return JSON.stringify({
    command: rule.command,
    present: rule.present,
    phase: rule.phase,
    guarded: rule.guarded,
  })
}

for (const rule of rules) {
  const key = rowKey(rule)
  if (table.has(key)) {
    throw new Error(`duplicate row ${key}`)
  }
  table.set(key, rule)
}

function copyNode(node: NodeRegister): NodeRegister {
  return {
    route: node.route,
    floor: node.floor,
    landed: node.landed.map((row) => ({ actor: row.actor, value: row.value, visible: row.visible })),
    phase: node.phase,
    runId: node.runId,
    readAt: node.readAt,
    guarded: node.guarded,
    claimed: node.claimed,
    stoppedAt: node.stoppedAt,
  }
}

function copyRegister(register: Register): Register {
  return {
    ...copyNode(register),
    nodes: [...register.nodes],
    readNodes: register.readNodes === null ? null : [...register.readNodes],
    b: register.b === null ? null : copyNode(register.b),
  }
}

function freezeNode(node: NodeRegister): void {
  for (const row of node.landed) {
    Object.freeze(row)
  }
  Object.freeze(node.landed)
}

function freezeRegister(register: Register): Register {
  const copy = copyRegister(register)
  freezeNode(copy)
  Object.freeze(copy.nodes)
  if (copy.readNodes !== null) {
    Object.freeze(copy.readNodes)
  }
  if (copy.b !== null) {
    freezeNode(copy.b)
    Object.freeze(copy.b)
  }
  return Object.freeze(copy)
}

function names(hasA: boolean, hasB: boolean): NodeName[] {
  const nodes: NodeName[] = []
  if (hasA) {
    nodes.push("a")
  }
  if (hasB) {
    nodes.push("b")
  }
  return nodes
}

function targetOf(command: Command): NodeName {
  if (command.command === "add") {
    return "b"
  }
  return command.node ?? "a"
}

function bodyOf(register: Register, node: NodeName): NodeRegister | null {
  if (node === "a") {
    return register
  }
  return register.b
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
  if (command.command === "person") {
    return JSON.stringify({
      command: command.command,
      present: true,
      phase: body.phase,
      guarded: body.guarded,
    })
  }
  return JSON.stringify({ command: command.command, present: true, phase: body.phase })
}

function commands(): readonly Command[] {
  return [
    { command: "add", node: "b" },
    { command: "remove", node: "b" },
    { command: "person", value: "p" },
    { command: "person", node: "b", value: "p" },
    { command: "agent", node: "b", runId: "s", readAt: 0, value: "a" },
    { command: "start", runId: "s" },
    { command: "stop", runId: "s" },
    { command: "read", runId: "s", node: "a" },
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
  if (visiblePeople(register) > 1) {
    return true
  }
  return register.b !== null && visiblePeople(register.b) > 1
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
    expect(after.nodes, key).toEqual(names(before.nodes.includes("a"), true))
    return
  }
  if (effect === "remove") {
    const node = targetOf(command)
    expect(after.nodes, key).toEqual(
      names(node === "a" ? false : before.nodes.includes("a"), node === "b" ? false : before.nodes.includes("b")),
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
    if (after.b === null) {
      throw new Error(`missing b ${key}`)
    }
    if (before.b === null) {
      expectBody(after.b, { version: 0, value: before.floor, phase: "idle", guarded: false }, key)
    } else {
      unchangedBody(after.b, before.b, key)
    }
    unchangedBody(after, before, key)
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
  if (effect === "person") {
    if (rule.guardedNext === undefined) {
      throw new Error(`missing guardedNext ${key}`)
    }
    if (command.command !== "person") {
      throw new Error(`person effect ${key}`)
    }
    expectBody(
      afterBody,
      {
        version: version(beforeBody) + 1,
        value: command.value,
        phase: beforeBody.phase,
        guarded: rule.guardedNext,
      },
      key,
    )
    return
  }
  if (effect === "start") {
    expectBody(
      afterBody,
      { version: version(beforeBody), value: currentValue(beforeBody), phase: "running", guarded: false },
      key,
    )
    return
  }
  expectBody(
    afterBody,
    {
      version: version(beforeBody),
      value: currentValue(beforeBody),
      phase: "stopped",
      guarded: beforeBody.guarded,
    },
    key,
  )
}

function sameIds(left: readonly NodeName[] | null, right: readonly NodeName[] | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  if (left.length !== right.length) {
    return false
  }
  return left.every((name, index) => name === right[index])
}

function noteVisit(register: Register, command: Command, decision: Decision, seen: Set<string>): void {
  if (command.command === "add" && decision.decision === "apply" && decision.register.nodes.includes("b")) {
    seen.add("Add b. b is present.")
  }
  if (command.command === "add" && decision.decision === "refuse" && decision.code === "present") {
    seen.add("Add b again. Refuse present.")
  }
  if (
    command.command === "agent" &&
    command.node === "b" &&
    decision.decision === "refuse" &&
    decision.code === "dead" &&
    register.b !== null &&
    !register.nodes.includes("b")
  ) {
    seen.add("Remove b. An agent edit of b refuses dead.")
  }
  if (
    command.command === "remove" &&
    command.node === "b" &&
    !register.nodes.includes("b") &&
    decision.decision === "refuse" &&
    decision.code === "dead"
  ) {
    seen.add("Remove absent b. Refuse dead.")
  }
  if (
    command.command === "person" &&
    command.node === undefined &&
    register.nodes.includes("a") &&
    decision.decision === "apply"
  ) {
    seen.add("Person edit of present a applies.")
  }
  if (
    (command.command === "add" || command.command === "remove") &&
    decision.decision === "apply" &&
    register.phase === "stopped" &&
    register.readNodes !== null &&
    sameIds(register.readNodes, register.nodes) &&
    sameIds(decision.register.readNodes, register.readNodes) &&
    !sameIds(decision.register.nodes, register.nodes)
  ) {
    seen.add("Stop a, then read run s. readNodes stays after a later structure step.")
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
    a: node(register),
    b: node(register.b),
  })
}

function enqueue(register: Register, queue: Register[], visited: Set<string>): void {
  if (tooManyPeople(register)) {
    return
  }
  const successor = freezeRegister(register)
  const id = identity(successor)
  if (visited.has(id)) {
    return
  }
  visited.add(id)
  queue.push(successor)
}

function finish(
  register: Register,
  command: Command,
  decision: Decision,
  rule: StructureRule,
  key: string,
  queue: Register[],
  visited: Set<string>,
  seen: Set<string>,
): void {
  if (rule.outcome === "refuse") {
    if (rule.code === undefined) {
      throw new Error(`missing code ${key}`)
    }
    expect(decision, key).toEqual({ decision: "refuse", code: rule.code })
    noteVisit(register, command, decision, seen)
    return
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
  enqueue(decision.register, queue, visited)
}

function checkCommand(
  register: Register,
  command: Command,
  queue: Register[],
  visited: Set<string>,
  seen: Set<string>,
): void {
  const key = situationKey(register, command)
  const before = copyRegister(register)
  const decision = decide(register, command)
  expect(register, key).toEqual(before)
  const rule = table.get(key)
  if (rule === undefined) {
    throw new Error(`missing row ${key}`)
  }
  finish(register, command, decision, rule, key, queue, visited, seen)
}

const required = [
  "Add b. b is present.",
  "Add b again. Refuse present.",
  "Remove b. An agent edit of b refuses dead.",
  "Remove absent b. Refuse dead.",
  "Person edit of present a applies.",
  "Stop a, then read run s. readNodes stays after a later structure step.",
  "read from idle refuses run-fenced.",
]

function walk(): void {
  const opened = freezeRegister(openRegister("floor", "slide"))
  const queue: Register[] = [opened]
  const visited = new Set<string>([identity(opened)])
  const seen = new Set<string>()
  let dequeued = 0
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      throw new Error("empty queue")
    }
    dequeued += 1
    if (dequeued > 80) {
      throw new Error("state cap hit")
    }
    for (const command of commands()) {
      checkCommand(current, command, queue, visited, seen)
    }
  }
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
