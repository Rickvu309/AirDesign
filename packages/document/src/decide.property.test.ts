import fc from "fast-check"
import { expect, it } from "vitest"
import { currentValue, decide, history, openRegister, type Command, type ElementId, type Register } from "./index.js"
import { elementId, shapeOf } from "./element-id.js"

const ids = [elementId("a"), elementId("258.7"), elementId("258.n4k2j9x0q1zab")] as const
const kinds = ["person", "start", "stop", "undo", "agent", "remove", "read", "add"] as const

function picture(register: Register, id: ElementId): string {
  if (id === elementId("a")) {
    return JSON.stringify({
      route: register.route,
      floor: register.floor,
      landed: register.landed,
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
  return JSON.stringify(register.elements[id] ?? null)
}

function three(): Register {
  let register = openRegister("floor", "slide")
  for (const id of [elementId("258.7"), elementId("258.n4k2j9x0q1zab")]) {
    const decision = decide(register, { command: "add", node: id, floor: id, route: "slide" })
    if (decision.decision !== "apply") throw new Error("add")
    register = decision.register
  }
  return register
}

function commandFor(kind: (typeof kinds)[number], id: ElementId): Command {
  switch (kind) {
    case "person":
      return { command: "person", node: id, value: "p" }
    case "start":
      return { command: "start", node: id, runId: "run" }
    case "stop":
      return { command: "stop", node: id, runId: "run" }
    case "undo":
      return { command: "undo", node: id, runId: "run" }
    case "agent":
      return { command: "agent", node: id, runId: "run", readAt: 0, value: "g" }
    case "remove":
      return { command: "remove", node: id }
    case "read":
      return { command: "read", node: id, runId: "run" }
    case "add":
      return { command: "add", node: elementId("258.8"), floor: "n", route: "r" }
  }
}

it("leaves every other element unchanged", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: ids.length - 1 }),
      fc.integer({ min: 0, max: kinds.length - 1 }),
      (idIndex, kindIndex) => {
        const target = ids[idIndex]
        const kind = kinds[kindIndex]
        if (target === undefined || kind === undefined) return false
        const register = three()
        const before = ids.map((id) => picture(register, id))
        const decision = decide(register, commandFor(kind, target))
        const after = decision.decision === "apply" ? decision.register : register
        const touched = kind === "add" ? elementId("258.8") : target
        return ids.every((id, index) => id === touched || before[index] === picture(after, id))
      },
    ),
  )
})

it("adds any id except the one openRegister created", () => {
  const first = elementId("258.7")
  const second = elementId("258.n4k2j9x0q1zab")
  const register = openRegister("floor", "slide")
  expect(shapeOf(first)).toEqual({ slide: "258", shape: "7" })
  expect(shapeOf(second)).toEqual({ slide: "258", shape: "n4k2j9x0q1zab" })
  expect(decide(register, { command: "add", node: elementId("a"), floor: "x", route: "y" })).toEqual({
    decision: "refuse",
    code: "present",
  })
  const removed = decide(register, { command: "remove", node: elementId("a") })
  if (removed.decision !== "apply") throw new Error("remove")
  expect(decide(removed.register, { command: "add", node: elementId("a"), floor: "x", route: "y" })).toEqual({
    decision: "refuse",
    code: "present",
  })
  const added = decide(register, { command: "add", node: first, floor: "one", route: "part" })
  if (added.decision !== "apply") throw new Error("add")
  const edited = decide(added.register, { command: "person", node: first, value: "kept" })
  if (edited.decision !== "apply") throw new Error("edit")
  expect(history(edited.register)).toEqual([])
  const dropped = decide(edited.register, { command: "remove", node: first })
  if (dropped.decision !== "apply") throw new Error("drop")
  expect(dropped.register.nodes.includes(first)).toBe(false)
  const again = decide(dropped.register, { command: "add", node: first, floor: "other", route: "elsewhere" })
  if (again.decision !== "apply") throw new Error("again")
  const kept = again.register.elements[first]
  if (kept === undefined) throw new Error("missing element")
  expect(currentValue(kept)).toBe("kept")
  expect(history(kept)).toEqual(["kept"])
  const third = decide(again.register, { command: "add", node: second, floor: "two", route: "part" })
  if (third.decision !== "apply") throw new Error("third")
  expect(third.register.nodes).toEqual([elementId("a"), first, second])
  const present = decide(third.register, { command: "add", node: second, floor: "two", route: "part" })
  expect(present).toEqual({ decision: "refuse", code: "present" })
  const other = third.register.elements[second]
  if (other === undefined) throw new Error("missing element")
  expect(history(edited.register)).toEqual([])
  expect(history(other)).toEqual([])
  expect(currentValue(other)).toBe("two")
})

const methodNames = ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"] as const

function rootPicture(register: Register): string {
  return JSON.stringify({
    route: register.route,
    floor: register.floor,
    landed: register.landed,
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

function elementPicture(register: Register, id: ElementId): string {
  if (!Object.hasOwn(register.elements, id)) return "null"
  return JSON.stringify(register.elements[id] ?? null)
}

function readBody(register: Register, id: ElementId) {
  if (!Object.hasOwn(register.elements, id)) throw new Error("missing element")
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing element")
  return body
}

it("opens a plain body for an id that names an object method", () => {
  for (const name of methodNames) {
    const id = elementId(name)
    const sibling = elementId("258.7")
    const opened = openRegister("floor", "slide")
    const siblingAdded = decide(opened, { command: "add", node: sibling, floor: "sib", route: "part" })
    if (siblingAdded.decision !== "apply") throw new Error("sibling")
    const root = rootPicture(siblingAdded.register)
    const other = elementPicture(siblingAdded.register, sibling)
    const added = decide(siblingAdded.register, { command: "add", node: id, floor: "base", route: "part" })
    expect(added.decision).toBe("apply")
    if (added.decision !== "apply") throw new Error("add")
    expect(rootPicture(added.register)).toBe(root)
    expect(elementPicture(added.register, sibling)).toBe(other)
    const nodes = [...added.register.nodes]
    const edited = decide(added.register, { command: "person", node: id, value: "typed" })
    expect(edited.decision).toBe("apply")
    if (edited.decision !== "apply") throw new Error("edit")
    expect(currentValue(readBody(edited.register, id))).toBe("typed")
    expect(rootPicture(edited.register)).toBe(root)
    expect(elementPicture(edited.register, sibling)).toBe(other)
    expect(edited.register.nodes).toEqual(nodes)
    const carried = JSON.parse(JSON.stringify(edited.register)) as Register
    expect(Object.hasOwn(carried.elements, id)).toBe(true)
    expect(currentValue(readBody(carried, id))).toBe("typed")
    const again = decide(carried, { command: "person", node: id, value: "again" })
    expect(again.decision).toBe("apply")
    if (again.decision !== "apply") throw new Error("round trip")
    expect(currentValue(readBody(again.register, id))).toBe("again")
    expect(rootPicture(again.register)).toBe(rootPicture(carried))
    expect(elementPicture(again.register, sibling)).toBe(elementPicture(carried, sibling))
    const fresh = openRegister("floor", "slide")
    expect(decide(fresh, { command: "person", node: id, value: "nope" })).toEqual({
      decision: "refuse",
      code: "dead",
    })
  }
})

it("throws missing node for a listed id that has no body", () => {
  for (const name of methodNames) {
    const id = elementId(name)
    const register = { ...openRegister("floor", "slide"), nodes: [elementId("a"), id] }
    expect(() => decide(register, { command: "person", value: "typed", node: id })).toThrow("missing node")
    expect(() => decide(register, { command: "read", runId: "r1", node: id })).toThrow("missing node")
  }
})

it("undoes each element of a run on its own", () => {
  const other = elementId("258.7")
  const opened = openRegister("floor", "slide")
  const added = decide(opened, { command: "add", node: other, floor: "one", route: "slide" })
  expect(added.decision).toBe("apply")
  if (added.decision !== "apply") return
  const run = "run"
  const firstStarted = decide(added.register, { command: "start", runId: run })
  expect(firstStarted.decision).toBe("apply")
  if (firstStarted.decision !== "apply") return
  const secondStarted = decide(firstStarted.register, { command: "start", runId: run, node: other })
  expect(secondStarted.decision).toBe("apply")
  if (secondStarted.decision !== "apply") return
  const firstWrote = decide(secondStarted.register, { command: "agent", runId: run, readAt: 0, value: "left" })
  expect(firstWrote.decision).toBe("apply")
  if (firstWrote.decision !== "apply") return
  const secondWrote = decide(firstWrote.register, {
    command: "agent",
    runId: run,
    readAt: 0,
    value: "right",
    node: other,
  })
  expect(secondWrote.decision).toBe("apply")
  if (secondWrote.decision !== "apply") return
  const firstUndone = decide(secondWrote.register, { command: "undo", runId: run })
  expect(firstUndone.decision).toBe("apply")
  if (firstUndone.decision !== "apply") return
  expect(firstUndone.register.phase).toBe("undone")
  expect(firstUndone.register.landed).toEqual([{ actor: "agent", value: "left", visible: false, runId: run }])
  const kept = firstUndone.register.elements[other]
  expect(kept?.phase).toBe("running")
  expect(kept?.landed).toEqual([{ actor: "agent", value: "right", visible: true, runId: run }])
  const secondUndone = decide(firstUndone.register, { command: "undo", runId: run, node: other })
  expect(secondUndone.decision).toBe("apply")
  if (secondUndone.decision !== "apply") return
  expect(secondUndone.register.phase).toBe("undone")
  expect(secondUndone.register.landed).toEqual([{ actor: "agent", value: "left", visible: false, runId: run }])
  const hidden = secondUndone.register.elements[other]
  expect(hidden?.phase).toBe("undone")
  expect(hidden?.landed).toEqual([{ actor: "agent", value: "right", visible: false, runId: run }])
})
