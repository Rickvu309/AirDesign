import { describe, expect, it } from "vitest"
import { currentValue, decide, history, openRegister, version, type Register } from "./decide.js"
import { elementId } from "./element-id.js"
import { replay, unsent, type Queued } from "./replay.js"

type ReplayRow = {
  readonly earlier: readonly string[]
  readonly queue: readonly Queued[]
  readonly acknowledged: number
  readonly pending: readonly Queued[]
  readonly history: readonly string[]
  readonly version: number
}

const table = new Map<string, ReplayRow>([
  [
    "order",
    {
      earlier: [],
      queue: [
        { base: 0, value: "one" },
        { base: 1, value: "two" },
      ],
      acknowledged: 0,
      pending: [
        { base: 0, value: "one" },
        { base: 1, value: "two" },
      ],
      history: ["one", "two"],
      version: 2,
    },
  ],
  [
    "stale",
    {
      earlier: [],
      queue: [
        { base: 0, value: "one" },
        { base: 0, value: "old" },
      ],
      acknowledged: 0,
      pending: [
        { base: 0, value: "one" },
        { base: 0, value: "old" },
      ],
      history: ["one"],
      version: 1,
    },
  ],
  [
    "ack",
    {
      earlier: ["sent"],
      queue: [
        { base: 0, value: "sent" },
        { base: 1, value: "next" },
      ],
      acknowledged: 1,
      pending: [{ base: 1, value: "next" }],
      history: ["sent", "next"],
      version: 2,
    },
  ],
  [
    "empty",
    {
      earlier: ["sent", "next"],
      queue: [
        { base: 0, value: "sent" },
        { base: 1, value: "next" },
      ],
      acknowledged: 2,
      pending: [],
      history: ["sent", "next"],
      version: 2,
    },
  ],
])

const required = [
  "Two matching edits land in queue order. History is that order.",
  "After the first lands, a later item that still names the old version is skipped.",
  "An acknowledged prefix is not applied again.",
  "An empty unsent suffix leaves the register unchanged.",
]

const names = new Map<string, string>([
  ["order", "Two matching edits land in queue order. History is that order."],
  ["stale", "After the first lands, a later item that still names the old version is skipped."],
  ["ack", "An acknowledged prefix is not applied again."],
  ["empty", "An empty unsent suffix leaves the register unchanged."],
])

function rowOf(name: string): ReplayRow {
  const row = table.get(name)
  if (row === undefined) {
    throw new Error(`missing row ${name}`)
  }
  return row
}

function picture(register: Register): string {
  return JSON.stringify(register)
}

function prepared(earlier: readonly string[]): Register {
  let register = openRegister("floor", "slide")
  for (const value of earlier) {
    register = replay(register, [{ base: version(register), value }])
  }
  return register
}

function visit(name: string, seen: Set<string>): void {
  const row = rowOf(name)
  const register = prepared(row.earlier)
  const before = picture(register)
  const pending = unsent(row.queue, row.acknowledged)
  expect(pending, name).toEqual(row.pending)
  const after = replay(register, pending)
  expect(picture(register), name).toBe(before)
  expect(history(after), name).toEqual(row.history)
  expect(version(after), name).toBe(row.version)
  if (row.pending.length === 0) {
    expect(picture(after), name).toBe(before)
  }
  seen.add(name)
}

function walk(): void {
  const seen = new Set<string>()
  visit("order", seen)
  visit("stale", seen)
  visit("ack", seen)
  visit("empty", seen)
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

describe("replay", () => {
  it("walks the unsent suffix in order", () => {
    walk()
  })

  it("applies a queued edit only to its element", () => {
    const right = elementId("258.7")
    const opened = decide(openRegister("left", "slide"), {
      command: "add",
      node: right,
      floor: "right",
      route: "other",
    })
    if (opened.decision !== "apply") throw new Error("add")
    const next = replay(opened.register, [
      { base: 0, value: "one", node: elementId("a") },
      { base: 0, value: "two", node: right },
    ])
    expect(history(next)).toEqual(["one"])
    expect(currentValue(next)).toBe("one")
    const other = next.elements[right]
    if (other === undefined) throw new Error("missing element")
    expect(history(other)).toEqual(["two"])
    expect(currentValue(other)).toBe("two")
  })
})
