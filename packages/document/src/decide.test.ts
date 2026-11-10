import { describe, expect, it } from "vitest"
import { currentValue, decide, history, openRegister, version, type Command, type Register } from "./decide.js"

function taken(register: Register, command: Command): Register {
  const decision = decide(register, command)
  expect(decision.decision).toBe("apply")
  if (decision.decision !== "apply") {
    throw new Error("refused")
  }
  return decision.register
}

describe("decide", () => {
  it("refuses the stale write TLC found", () => {
    const started = taken(openRegister("original", "slide"), { command: "start", runId: "r" })
    const during = taken(started, { command: "person", value: "during" })
    const decision = decide(during, { command: "agent", runId: "r", readAt: 0, value: "agent" })
    expect(decision).toEqual({ decision: "refuse", code: "stale" })
    expect(version(during)).toBe(1)
    expect(currentValue(during)).toBe("during")
    expect(history(during)).toEqual(["during"])
  })

  it("refuses a fresh read while the person is guarding", () => {
    const started = taken(openRegister("original", "slide"), { command: "start", runId: "r" })
    const during = taken(started, { command: "person", value: "during" })
    const decision = decide(during, { command: "agent", runId: "r", readAt: 1, value: "agent" })
    expect(decision).toEqual({ decision: "refuse", code: "person-protected" })
  })

  it("refuses a stale write when the guard is still false", () => {
    const first = taken(openRegister("original", "slide"), { command: "person", value: "a" })
    const second = taken(first, { command: "person", value: "b" })
    const started = taken(second, { command: "start", runId: "r" })
    const decision = decide(started, { command: "agent", runId: "r", readAt: 0, value: "agent" })
    expect(decision).toEqual({ decision: "refuse", code: "stale" })
    expect(started.guarded).toBe(false)
    expect(version(started)).toBe(2)
  })

  it("fences an agent write after stop and still accepts a later person edit", () => {
    const started = taken(openRegister("original", "slide"), { command: "start", runId: "r" })
    const stopped = taken(started, { command: "stop", runId: "r" })
    const decision = decide(stopped, { command: "agent", runId: "r", readAt: 0, value: "agent" })
    expect(decision).toEqual({ decision: "refuse", code: "run-fenced" })
    const later = taken(stopped, { command: "person", value: "later" })
    expect(version(later)).toBe(1)
    expect(currentValue(later)).toBe("later")
  })

  it("keeps both person edits when the run is undone", () => {
    const first = taken(openRegister("original", "slide"), { command: "person", value: "a" })
    const started = taken(first, { command: "start", runId: "r" })
    const written = taken(started, { command: "agent", runId: "r", readAt: 1, value: "b" })
    const second = taken(written, { command: "person", value: "c" })
    const undone = taken(second, { command: "undo", runId: "r" })
    expect(history(undone)).toEqual(["a", "c"])
    expect(version(undone)).toBe(2)
    expect(currentValue(undone)).toBe("c")
  })

  it("undoes a run that wrote nothing", () => {
    const started = taken(openRegister("original", "slide"), { command: "start", runId: "r" })
    const during = taken(started, { command: "person", value: "a" })
    const undone = taken(during, { command: "undo", runId: "r" })
    expect(history(undone)).toEqual(["a"])
    expect(version(undone)).toBe(1)
    expect(undone.phase).toBe("undone")
  })

  it("applies a person edit in idle, running, stopped, and undone", () => {
    const idle = openRegister("original", "slide")
    expect(decide(idle, { command: "person", value: "idle" }).decision).toBe("apply")
    const running = taken(idle, { command: "start", runId: "r" })
    expect(decide(running, { command: "person", value: "running" }).decision).toBe("apply")
    const stopped = taken(running, { command: "stop", runId: "r" })
    expect(decide(stopped, { command: "person", value: "stopped" }).decision).toBe("apply")
    const undone = taken(running, { command: "undo", runId: "r" })
    expect(decide(undone, { command: "person", value: "undone" }).decision).toBe("apply")
  })

  it("applies an agent write that names the current version", () => {
    const first = taken(openRegister("original", "slide"), { command: "person", value: "a" })
    const started = taken(first, { command: "start", runId: "r" })
    const decision = decide(started, { command: "agent", runId: "r", readAt: 1, value: "b" })
    expect(decision.decision).toBe("apply")
    if (decision.decision !== "apply") {
      throw new Error("refused")
    }
    expect(version(decision.register)).toBe(2)
    expect(currentValue(decision.register)).toBe("b")
    expect(decision.register.claimed).toBe(1)
  })

  it("returns the route and leaves it unchanged", () => {
    const opened = openRegister("original", "slide")
    const decision = decide(opened, { command: "person", value: "a" })
    expect(decision).toMatchObject({ decision: "apply", route: "slide" })
    if (decision.decision !== "apply") {
      throw new Error("refused")
    }
    expect(decision.register.route).toBe("slide")
    expect(decision.register.route).toBe(opened.route)
  })

  it("does not mutate the register it was given", () => {
    const started = taken(openRegister("original", "slide"), { command: "start", runId: "r" })
    const during = taken(started, { command: "person", value: "during" })
    const row = during.landed[0]
    decide(during, { command: "agent", runId: "r", readAt: 1, value: "agent" })
    expect(during.phase).toBe("running")
    expect(during.guarded).toBe(true)
    expect(during.landed).toHaveLength(1)
    expect(row).toEqual({ actor: "person", value: "during", visible: true })
    expect(started.landed).toEqual([])
    expect(started.guarded).toBe(false)
  })
})
