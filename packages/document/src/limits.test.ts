import { describe, expect, it } from "vitest"
import { decide, decideUndo, openRegister, type Register } from "./decide.js"
import { limits, overLimit } from "./limits.js"

type InsideRow = {
  readonly decision: "inside"
  readonly decks: number
  readonly slides: number
  readonly bytes: number
  readonly edit: boolean
}

type OutsideRow = {
  readonly decision: "refuse"
  readonly code: "limit"
  readonly slides: number
  readonly bytes: number
  readonly call: "person" | "absent" | "undo" | "direct"
}

type LimitRow = InsideRow | OutsideRow

const ceiling = limits.bytes

const table = new Map<string, LimitRow>([
  ["decks", { decision: "inside", decks: 2, slides: 50, bytes: ceiling - 1, edit: true }],
  ["opened", { decision: "inside", decks: 1, slides: 1, bytes: 0, edit: false }],
  ["slides", { decision: "refuse", code: "limit", slides: 51, bytes: 0, call: "person" }],
  ["bytes", { decision: "refuse", code: "limit", slides: 1, bytes: ceiling, call: "person" }],
  ["absent", { decision: "refuse", code: "limit", slides: 51, bytes: 0, call: "absent" }],
  ["undo", { decision: "refuse", code: "limit", slides: 51, bytes: 0, call: "undo" }],
  ["direct", { decision: "refuse", code: "limit", slides: 51, bytes: 0, call: "direct" }],
])

const required = ["decks", "opened", "slides", "bytes", "absent", "undo", "direct"]

function rowOf(name: string): LimitRow {
  const row = table.get(name)
  if (row === undefined) {
    throw new Error(`missing row ${name}`)
  }
  return row
}

function counted(slides: number, bytes: number): Register {
  return { ...openRegister("floor", "slide"), slides, bytes }
}

function copyRegister(register: Register): Register {
  return {
    route: register.route,
    floor: register.floor,
    landed: register.landed.map((row) => ({ actor: row.actor, value: row.value, visible: row.visible })),
    phase: register.phase,
    runId: register.runId,
    readAt: register.readAt,
    guarded: register.guarded,
    claimed: register.claimed,
    stoppedAt: register.stoppedAt,
    slides: register.slides,
    bytes: register.bytes,
    nodes: [...register.nodes],
    readNodes: register.readNodes === null ? null : [...register.readNodes],
    b:
      register.b === null
        ? null
        : {
            route: register.b.route,
            floor: register.b.floor,
            landed: register.b.landed.map((row) => ({
              actor: row.actor,
              value: row.value,
              visible: row.visible,
            })),
            phase: register.b.phase,
            runId: register.b.runId,
            readAt: register.b.readAt,
            guarded: register.b.guarded,
            claimed: register.b.claimed,
            stoppedAt: register.b.stoppedAt,
            slides: register.b.slides,
            bytes: register.b.bytes,
          },
  }
}

function visitInside(name: string, seen: Set<string>): void {
  const row = rowOf(name)
  if (row.decision !== "inside") {
    throw new Error(`refuse row ${name}`)
  }
  const register = row.edit ? counted(row.slides, row.bytes) : openRegister("floor", "slide")
  expect(register.slides, name).toBe(row.slides)
  expect(register.bytes, name).toBe(row.bytes)
  expect(overLimit({ decks: row.decks, slides: register.slides, bytes: register.bytes }), name).toBe(false)
  if (!row.edit) {
    seen.add(name)
    return
  }
  const before = copyRegister(register)
  const decision = decide(register, { command: "person", value: "kept" })
  expect(register, name).toEqual(before)
  expect(decision.decision, name).toBe("apply")
  if (decision.decision !== "apply") {
    throw new Error(`refused ${name}`)
  }
  expect(decision.register.slides, name).toBe(50)
  expect(decision.register.bytes, name).toBe(row.bytes)
  seen.add(name)
}

function visitOutside(name: string, seen: Set<string>): void {
  const row = rowOf(name)
  if (row.decision !== "refuse") {
    throw new Error(`inside row ${name}`)
  }
  const register = counted(row.slides, row.bytes)
  const before = copyRegister(register)
  const decision =
    row.call === "direct"
      ? decideUndo(register, "r")
      : decide(
          register,
          row.call === "person"
            ? { command: "person", value: "kept" }
            : row.call === "absent"
              ? { command: "remove", node: "b" }
              : { command: "undo", runId: "r" },
        )
  expect(decision, name).toEqual({ decision: "refuse", code: row.code })
  expect(register, name).toEqual(before)
  seen.add(name)
}

function walk(): void {
  expect(limits.decks).toBe(null)
  expect(limits.slides).toBe(50)
  expect(limits.bytes).toBe(70 * 1024 * 1024)
  const seen = new Set<string>()
  visitInside("decks", seen)
  visitInside("opened", seen)
  visitOutside("slides", seen)
  visitOutside("bytes", seen)
  visitOutside("absent", seen)
  visitOutside("undo", seen)
  visitOutside("direct", seen)
  for (const name of required) {
    if (!seen.has(name)) {
      throw new Error(`not visited: ${name}`)
    }
  }
  for (const name of table.keys()) {
    if (!seen.has(name)) {
      throw new Error(`not visited: ${name}`)
    }
  }
}

describe("limits", () => {
  it("holds a deck inside the table", () => {
    walk()
  })
})
