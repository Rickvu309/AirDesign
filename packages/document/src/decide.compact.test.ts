import { describe, expect, it } from "vitest"
import { compactChain, currentValue, history, version, type NodeRegister, type Phase } from "./decide.js"

type CompactRow = {
  readonly landed: NodeRegister["landed"]
  readonly version: number
  readonly value: string
  readonly history: readonly string[]
  readonly floor: string
  readonly phase: Phase
  readonly guarded: boolean
}

const hiddenChain: NodeRegister = {
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

const personChain: NodeRegister = {
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

const keptPerson: CompactRow = {
  landed: [{ actor: "person", value: "kept", visible: true }],
  version: 1,
  value: "kept",
  history: ["kept"],
  floor: "floor",
  phase: "undone",
  guarded: false,
}

const table = new Map<string, CompactRow>([
  [
    "keeps-hidden",
    {
      landed: [
        { actor: "person", value: "kept", visible: true },
        { actor: "agent", value: "gone", visible: false },
      ],
      version: 1,
      value: "kept",
      history: ["kept"],
      floor: "floor",
      phase: "undone",
      guarded: false,
    },
  ],
  ["drops-hidden", keptPerson],
  ["keeps-person", keptPerson],
])

const required = [
  "eligible false keeps a hidden agent row",
  "eligible true drops that hidden row",
  "eligible true does not drop a visible person row",
]

function rowOf(name: string): CompactRow {
  const row = table.get(name)
  if (row === undefined) {
    throw new Error(`missing row ${name}`)
  }
  return row
}

function expectChain(actual: NodeRegister, name: string): void {
  const row = rowOf(name)
  expect(actual.landed, name).toEqual(row.landed)
  expect(version(actual), name).toBe(row.version)
  expect(currentValue(actual), name).toBe(row.value)
  expect(history(actual), name).toEqual(row.history)
  expect(actual.floor, name).toBe(row.floor)
  expect(actual.phase, name).toBe(row.phase)
  expect(actual.guarded, name).toBe(row.guarded)
}

function walk(): void {
  const seen = new Set<string>()
  expectChain(compactChain(hiddenChain, false), "keeps-hidden")
  seen.add("keeps-hidden")
  expectChain(compactChain(hiddenChain, true), "drops-hidden")
  seen.add("drops-hidden")
  expectChain(compactChain(personChain, true), "keeps-person")
  seen.add("keeps-person")
  const names = new Map<string, string>([
    ["keeps-hidden", "eligible false keeps a hidden agent row"],
    ["drops-hidden", "eligible true drops that hidden row"],
    ["keeps-person", "eligible true does not drop a visible person row"],
  ])
  for (const name of required) {
    const key = [...names.entries()].find((entry) => entry[1] === name)?.[0]
    if (key === undefined || !seen.has(key)) {
      throw new Error(`not visited: ${name}`)
    }
  }
}

describe("compact", () => {
  it("walks compaction of a hidden row", () => {
    walk()
  })
})
