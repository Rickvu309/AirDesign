import fc from "fast-check"
import { describe, expect, it } from "vitest"
import {
  compactChain,
  currentValue,
  decide,
  history,
  openRegister,
  version,
  type Command,
  type NodeRegister,
  type Register,
} from "./decide.js"
import { elementId, rootElement, type ElementId } from "./element-id.js"
import { replay } from "./replay.js"

function applied(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function played(commands: readonly Command[]): Register {
  return commands.reduce(applied, openRegister("floor", "slide"))
}

const agentRun: readonly Command[] = [
  { command: "start", runId: "first" },
  { command: "agent", runId: "first", readAt: 0, value: "agent text" },
]

describe("version", () => {
  it("refuses as stale an agent edit whose read came before an undo and a person edit", () => {
    const edited = played(agentRun)
    const read = version(edited)
    expect(read).toBe(1)
    const undone = applied(edited, { command: "undo", runId: "first" })
    const typed = applied(undone, { command: "person", value: "person never read" })
    const started = applied(typed, { command: "start", runId: "second" })
    expect(decide(started, { command: "agent", runId: "second", readAt: read, value: "overwrite" })).toEqual({
      decision: "refuse",
      code: "stale",
    })
    expect(
      decide(started, { command: "agent", runId: "second", readAt: version(started), value: "after a read" }).decision,
    ).toBe("apply")
  })

  it("skips a queued person edit whose base came before an undo and a person edit", () => {
    const edited = played(agentRun)
    const queued = { base: version(edited), value: "queued offline" }
    const undone = applied(edited, { command: "undo", runId: "first" })
    const typed = applied(undone, { command: "person", value: "typed since" })
    const after = replay(typed, [queued])
    expect(after).toBe(typed)
    expect(currentValue(after)).toBe("typed since")
    expect(history(after)).toEqual(["typed since"])
  })

  it("refuses as stale an agent that read while its row showed, after an undo", () => {
    const edited = played(agentRun)
    const read = version(edited)
    const undone = applied(edited, { command: "undo", runId: "first" })
    expect(currentValue(undone)).toBe("floor")
    const started = applied(undone, { command: "start", runId: "second" })
    expect(decide(started, { command: "agent", runId: "second", readAt: read, value: "stale" })).toEqual({
      decision: "refuse",
      code: "stale",
    })
  })

  it("refuses as stale a read made before the undo of an earlier run", () => {
    const later = played([
      ...agentRun,
      { command: "stop", runId: "first" },
      { command: "start", runId: "second" },
      { command: "stop", runId: "second" },
    ])
    const read = version(later)
    const undone = applied(later, { command: "undo", runId: "first" })
    expect(version(undone)).toBe(read + 1)
    const started = applied(undone, { command: "start", runId: "third" })
    expect(decide(started, { command: "agent", runId: "third", readAt: read, value: "stale" })).toEqual({
      decision: "refuse",
      code: "stale",
    })
  })

  it("rises by one for each row an undo hides", () => {
    const edited = played([...agentRun, { command: "agent", runId: "first", readAt: 0, value: "more" }])
    expect(version(edited)).toBe(2)
    expect(version(applied(edited, { command: "undo", runId: "first" }))).toBe(4)
  })

  it("keeps the number on an undo that hides no row", () => {
    const started = played([
      { command: "person", value: "kept" },
      { command: "start", runId: "first" },
    ])
    const undone = applied(started, { command: "undo", runId: "first" })
    expect(version(undone)).toBe(version(started))
    expect(currentValue(undone)).toBe("kept")
  })

  it("keeps the number through compaction, so a later edit gets a new one", () => {
    const undone = applied(played(agentRun), { command: "undo", runId: "first" })
    const compacted = compactChain(undone, true)
    expect(compacted.landed).toEqual([])
    expect(version(compacted)).toBe(version(undone))
    const typed = applied({ ...undone, ...compacted }, { command: "person", value: "typed" })
    expect(version(typed)).toBe(version(undone) + 1)
  })

  it("raises an agent edit from the stored number after a compaction", () => {
    const undone = applied(played(agentRun), { command: "undo", runId: "first" })
    const compacted = { ...undone, ...compactChain(undone, true) }
    expect(compacted.landed).toEqual([])
    const before = version(compacted)
    expect(before).toBe(2)
    const started = applied(compacted, { command: "start", runId: "second" })
    const landed = applied(started, { command: "agent", runId: "second", readAt: before, value: "again" })
    expect(version(landed)).toBe(before + 1)
  })

  it("raises an undo from the stored number after a compaction", () => {
    const undone = applied(played(agentRun), { command: "undo", runId: "first" })
    const compacted = { ...undone, ...compactChain(undone, true) }
    const started = applied(compacted, { command: "start", runId: "second" })
    const landed = applied(started, { command: "agent", runId: "second", readAt: version(compacted), value: "again" })
    const before = version(landed)
    const again = applied(landed, { command: "undo", runId: "second" })
    expect(version(again)).toBe(before + 1)
  })

  it("reads a register stored without the number as its landed rows plus its hidden rows", () => {
    const stored: NodeRegister = {
      ...openRegister("floor", "slide"),
      landed: [
        { actor: "person", value: "kept", visible: true },
        { actor: "agent", value: "gone", visible: false, runId: "first" },
      ],
    }
    expect(Object.hasOwn(stored, "version")).toBe(false)
    expect(version(stored)).toBe(3)
    expect(version(compactChain(stored, true))).toBe(3)
    expect(version(compactChain(stored, false))).toBe(3)
  })

  it("gives a register stored without the number the same reading as one that kept it", () => {
    const kept = applied(played(agentRun), { command: "undo", runId: "first" })
    const { version: dropped, ...stored } = kept
    expect(version(stored)).toBe(dropped)
    expect(version(applied(stored, { command: "person", value: "typed" }))).toBe(version(kept) + 1)
  })

  it("lands a batch of two on the read it started from", () => {
    const started = played([
      { command: "person", value: "before" },
      { command: "start", runId: "first" },
    ])
    const read = version(started)
    const one = applied(started, { command: "agent", runId: "first", readAt: read, value: "one" })
    const two = applied(one, { command: "agent", runId: "first", readAt: read, value: "two" })
    expect(two.claimed).toBe(read)
    expect(version(two)).toBe(read + 2)
    expect(history(two)).toEqual(["before", "one", "two"])
  })

  const kinds = ["person", "start", "agent", "stop", "undo", "compact"] as const
  const runs = ["first", "second"] as const
  const steps = fc.array(fc.tuple(fc.constantFrom(...kinds), fc.constantFrom(...runs)), { maxLength: 40, size: "max" })

  function bodyOf(register: Register, node: ElementId): NodeRegister {
    if (node === rootElement) return register
    const body = register.elements[node]
    if (body === undefined) throw new Error("missing node")
    return body
  }

  function compacted(register: Register, node: ElementId): Register {
    const body = compactChain(bodyOf(register, node), true)
    if (node === rootElement) return { ...register, ...body }
    return { ...register, elements: { ...register.elements, [node]: body } }
  }

  function stepped(
    register: Register,
    node: ElementId,
    kind: (typeof kinds)[number],
    runId: string,
    value: string,
  ): Register {
    if (kind === "compact") return compacted(register, node)
    const command: Command =
      kind === "person"
        ? { command: "person", node, value }
        : kind === "agent"
          ? { command: "agent", node, runId, readAt: version(bodyOf(register, node)), value }
          : { command: kind, node, runId }
    const decision = decide(register, command)
    return decision.decision === "apply" ? decision.register : register
  }

  it.each([
    ["the opened element", rootElement],
    ["a map element", elementId("258.7")],
  ])("never falls and never shows two values at one number on %s", (_name, node) => {
    const opened =
      node === rootElement
        ? openRegister("floor", "slide")
        : applied(openRegister("floor", "slide"), { command: "add", node, floor: "floor", route: "slide" })
    fc.assert(
      fc.property(steps, (list) => {
        let register = opened
        let last = 0
        const shownAt = new Map<number, string>([[0, "floor"]])
        for (const [index, [kind, runId]] of list.entries()) {
          register = stepped(register, node, kind, runId, `value ${String(index)}`)
          const body = bodyOf(register, node)
          const now = version(body)
          expect(now).toBeGreaterThanOrEqual(last)
          expect(currentValue(body)).toBe(shownAt.get(now) ?? currentValue(body))
          shownAt.set(now, currentValue(body))
          last = now
        }
      }),
      { numRuns: 2000 },
    )
  })
})
