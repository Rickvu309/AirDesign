import { describe, expect, it } from "vitest"
import {
  currentValue,
  decide,
  decideUndo,
  history,
  openRegister,
  version,
  type Actor,
  type Command,
  type NodeRegister,
  type Phase,
  type Register,
} from "./decide.js"
import { copyNode, freezeNode } from "./decide.walk.js"

type LandedRow = {
  readonly actor: Actor
  readonly value: string
  readonly visible: boolean
}

type ApplyRow = {
  readonly decision: "apply"
  readonly beforeVersion: number
  readonly beforeValue: string
  readonly beforeHistory: readonly string[]
  readonly body: NodeRegister
  readonly version: number
  readonly value: string
  readonly history: readonly string[]
}

type RefuseRow = {
  readonly decision: "refuse"
  readonly code: "run-fenced"
}

type UndoRow = ApplyRow | RefuseRow

const agentAndPerson: NodeRegister = {
  route: "slide",
  floor: "floor",
  landed: [
    { actor: "person", value: "kept", visible: true },
    { actor: "agent", value: "gone", visible: false },
  ],
  phase: "undone",
  runId: "r",
  readAt: 1,
  guarded: false,
  claimed: 1,
  stoppedAt: null,
  slides: 1,
  bytes: 0,
}

const noAgent: NodeRegister = {
  route: "slide",
  floor: "floor",
  landed: [{ actor: "person", value: "kept", visible: true }],
  phase: "undone",
  runId: "r",
  readAt: 1,
  guarded: false,
  claimed: null,
  stoppedAt: null,
  slides: 1,
  bytes: 0,
}

const table = new Map<string, UndoRow>([
  [
    "agent-and-person",
    {
      decision: "apply",
      beforeVersion: 2,
      beforeValue: "gone",
      beforeHistory: ["kept", "gone"],
      body: agentAndPerson,
      version: 1,
      value: "kept",
      history: ["kept"],
    },
  ],
  [
    "no-agent",
    {
      decision: "apply",
      beforeVersion: 1,
      beforeValue: "kept",
      beforeHistory: ["kept"],
      body: noAgent,
      version: 1,
      value: "kept",
      history: ["kept"],
    },
  ],
  ["second-undo", { decision: "refuse", code: "run-fenced" }],
  ["wrong-run", { decision: "refuse", code: "run-fenced" }],
])

const required = [
  "Undo of a run with an agent row and a person row",
  "Undo of a run that landed no agent write",
  "A second undo refuses run-fenced",
  "Undo with the wrong run id refuses run-fenced",
]

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") {
    throw new Error(`refused ${command.command}`)
  }
  return decision.register
}

function nodeFrom(register: Register): NodeRegister {
  return freezeNode({
    route: register.route,
    floor: register.floor,
    landed: register.landed.map((row: LandedRow) => ({
      actor: row.actor,
      value: row.value,
      visible: row.visible,
    })),
    phase: register.phase,
    runId: register.runId,
    readAt: register.readAt,
    guarded: register.guarded,
    claimed: register.claimed,
    stoppedAt: register.stoppedAt,
    slides: register.slides,
    bytes: register.bytes,
  })
}

function withPersonAndAgent(): NodeRegister {
  let register = openRegister("floor", "slide")
  register = applied(register, { command: "person", value: "kept" })
  register = applied(register, { command: "start", runId: "r" })
  register = applied(register, { command: "agent", runId: "r", readAt: 1, value: "gone" })
  return nodeFrom(register)
}

function withPersonOnly(): NodeRegister {
  let register = openRegister("floor", "slide")
  register = applied(register, { command: "person", value: "kept" })
  register = applied(register, { command: "start", runId: "r" })
  return nodeFrom(register)
}

function rowOf(name: string): UndoRow {
  const row = table.get(name)
  if (row === undefined) {
    throw new Error(`missing row ${name}`)
  }
  return row
}

function appliedUndo(register: NodeRegister, runId: string, name: string, seen: Set<string>): NodeRegister {
  const row = rowOf(name)
  if (row.decision !== "apply") {
    throw new Error(`refuse row ${name}`)
  }
  const before = copyNode(register)
  expect(version(register), name).toBe(row.beforeVersion)
  expect(currentValue(register), name).toBe(row.beforeValue)
  expect(history(register), name).toEqual(row.beforeHistory)
  const decision = decideUndo(register, runId)
  expect(register, name).toEqual(before)
  expect(decision, name).toEqual({ decision: "apply", body: row.body })
  if (decision.decision !== "apply") {
    throw new Error(`refused ${name}`)
  }
  expect(version(decision.body), name).toBe(row.version)
  expect(currentValue(decision.body), name).toBe(row.value)
  expect(history(decision.body), name).toEqual(row.history)
  expect(decision.body.phase, name).toBe("undone" satisfies Phase)
  seen.add(name)
  return decision.body
}

function refusedUndo(register: NodeRegister, runId: string, name: string, seen: Set<string>): void {
  const row = rowOf(name)
  if (row.decision !== "refuse") {
    throw new Error(`apply row ${name}`)
  }
  const before = copyNode(register)
  const decision = decideUndo(register, runId)
  expect(decision, name).toEqual({ decision: "refuse", code: row.code })
  expect(register, name).toEqual(before)
  seen.add(name)
}

function walk(): void {
  const seen = new Set<string>()
  const running = withPersonAndAgent()
  refusedUndo(running, "s", "wrong-run", seen)
  const undone = freezeNode(appliedUndo(running, "r", "agent-and-person", seen))
  refusedUndo(undone, "r", "second-undo", seen)
  appliedUndo(withPersonOnly(), "r", "no-agent", seen)
  const names = new Map<string, string>([
    ["agent-and-person", "Undo of a run with an agent row and a person row"],
    ["no-agent", "Undo of a run that landed no agent write"],
    ["second-undo", "A second undo refuses run-fenced"],
    ["wrong-run", "Undo with the wrong run id refuses run-fenced"],
  ])
  for (const key of names.keys()) {
    if (!seen.has(key)) {
      throw new Error(`not visited: ${names.get(key)}`)
    }
  }
  for (const name of required) {
    if (![...names.values()].includes(name)) {
      throw new Error(`not visited: ${name}`)
    }
  }
}

describe("undo", () => {
  it("walks undo of a landed row", () => {
    walk()
  })
})
