import { expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId } from "./element-id.js"
import { foldGrid, gridRows } from "./grid-order.js"
import { foldSections } from "./section-order.js"
import { redoOf, slideUndoable, undoOf } from "./person-undo.js"
import { presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"

function opened(count = 6): Register {
  return { ...openRegister("", ""), file: Array.from({ length: count }, (_, i) => slideId(String(i + 256))) }
}

function addition(register: Register, after = "256", id = "300", row = "new"): SlideCommand {
  const parsed = readSlideState({
    file: register.file,
    order: [{ slide: "add", grid: 1, row, id, after, layout: "256" }],
  })?.order[0]
  if (parsed === undefined) throw new Error("add placement was not decoded")
  return parsed
}

function apply(register: Register, edit: SlideCommand): Register {
  const result = decide(register, { command: "slide", file: register.file, edit })
  if (result.decision !== "apply") throw new Error(result.code)
  return result.register
}

function turned(register: Register, result: ReturnType<typeof undoOf>): Register {
  if (!result.ok) throw new Error("turn refused")
  for (const command of result.commands) {
    const answer = decide(register, command)
    if (answer.decision !== "apply") throw new Error(answer.code)
    register = answer.register
  }
  return register
}

it("adds below an interior row at its tail and keeps the next row intact", () => {
  const register = opened()
  const edit = addition(register)
  const added = apply(register, edit)
  expect(gridRows(added)).toEqual([["256", "257", "258", "259"], ["300"], ["260", "261"]])
  expect(added.order.at(-1)).toEqual({ slide: "add", grid: 1, row: "new", id: "300", after: "256", layout: "256" })
  expect(foldGrid(added).effects.at(-1)).toMatchObject({ slide: "add", id: "300", after: "259" })
  expect(readSlideState(JSON.parse(JSON.stringify(added)))).toEqual({ file: added.file, order: added.order })
})

it("adds below the final row without changing its members", () => {
  const register = opened()
  const added = apply(register, addition(register, "260"))
  expect(gridRows(added)).toEqual([["256", "257", "258", "259"], ["260", "261"], ["300"]])
})

it("inherits the section at the resolved row tail without creating a section", () => {
  const register = opened()
  const sections = [
    { name: "Opening", slides: ["256", "257"] },
    { name: "Results", slides: ["258", "259", "260", "261"] },
  ]
  const added = apply(register, addition(register))
  expect(foldSections(added, sections)).toEqual([
    { name: "Opening", slides: ["256", "257"] },
    { name: "Results", slides: ["258", "259", "300", "260", "261"] },
  ])
})

it("resolves a queued below add after a foreign append to the source row", () => {
  const register = opened()
  const queued = addition(register)
  const foreign = apply(register, addition(register, "259", "301", "same"))
  const added = apply(foreign, queued)
  expect(gridRows(added)).toEqual([["256", "257", "258", "259", "301"], ["300"], ["260", "261"]])
  expect(foldGrid(added).effects.at(-1)).toMatchObject({ after: "301" })
})

it("keeps two accepted below adds in separate rows after their current source row", () => {
  const register = opened()
  const first = addition(register)
  const second = addition(register, "257", "301")
  expect(gridRows(apply(apply(register, first), second))).toEqual([
    ["256", "257", "258", "259"],
    ["301"],
    ["300"],
    ["260", "261"],
  ])
})

it("refuses a queued below add whose semantic anchor was deleted", () => {
  const register = opened()
  const queued = addition(register)
  const changed = apply(register, { slide: "remove", grid: 1, id: slideId("256") })
  const before = JSON.stringify(changed)
  expect(decide(changed, { command: "slide", file: changed.file, edit: queued })).toMatchObject({
    decision: "refuse",
    code: "dead",
  })
  expect(JSON.stringify(changed)).toBe(before)
})

it("undoes and redoes a below add with the same rows", () => {
  const register = opened()
  const edit = addition(register)
  const undoable = slideUndoable(register, register.file, edit)
  if (undoable === null) throw new Error("undoable")
  const added = apply(register, edit)
  const undone = turned(added, undoOf(added, undoable))
  expect(gridRows(undone)).toEqual(gridRows(register))
  expect(gridRows(turned(undone, redoOf(undone, undoable)))).toEqual(gridRows(added))
  expect(undone.order[0]).toHaveProperty("grid", 1)
})

it("undoes a below add after a foreign insertion inside the source row", () => {
  const register = opened()
  const edit = addition(register)
  const undoable = slideUndoable(register, register.file, edit)
  if (undoable === null) throw new Error("undoable")
  const added = apply(register, edit)
  const foreign = apply(added, addition(added, "257", "301", "same"))
  const undone = turned(foreign, undoOf(foreign, undoable))
  expect(gridRows(undone)).toEqual([
    ["256", "257", "301", "258", "259"],
    ["260", "261"],
  ])
})

it("guards a below-add inverse on the server when another person fills the new row", () => {
  const register = opened()
  const edit = addition(register)
  const undoable = slideUndoable(register, register.file, edit)
  if (undoable === null) throw new Error("undoable")
  const added = apply(register, edit)
  const inverse = undoOf(added, undoable)
  if (!inverse.ok || inverse.commands[0] === undefined) throw new Error("inverse")
  const foreign = apply(added, addition(added, "300", "301", "same"))
  expect(decide(foreign, inverse.commands[0])).toMatchObject({ decision: "refuse", code: "stale" })
  expect(undoOf(foreign, undoable).ok).toBe(false)
  expect(gridRows(foreign)).toEqual([
    ["256", "257", "258", "259"],
    ["300", "301"],
    ["260", "261"],
  ])
})

it("refuses a redo that would steal a newer source-tail insertion into the restored row", () => {
  const register = opened()
  const edit = addition(register)
  const undoable = slideUndoable(register, register.file, edit)
  if (undoable === null) throw new Error("undoable")
  const added = apply(register, edit)
  const undone = turned(added, undoOf(added, undoable))
  const foreign = apply(undone, addition(undone, "259", "301", "same"))
  expect(redoOf(foreign, undoable).ok).toBe(false)
  expect(gridRows(foreign)).toEqual([
    ["256", "257", "258", "259", "301"],
    ["260", "261"],
  ])
})

it("adds the fiftieth slide as a singleton and refuses the fifty-first atomically", () => {
  const register = opened(49)
  const added = apply(register, addition(register, "304", "400"))
  expect(presentSlides(added)).toHaveLength(50)
  expect(gridRows(added).at(-1)).toEqual(["400"])
  const before = JSON.stringify(added)
  expect(decide(added, { command: "slide", file: added.file, edit: addition(added, "304", "401") })).toMatchObject({
    decision: "refuse",
    code: "limit",
  })
  expect(JSON.stringify(added)).toBe(before)
  const untouched = opened(50)
  expect(
    decide(untouched, { command: "slide", file: untouched.file, edit: addition(untouched, "256", "400") }),
  ).toMatchObject({
    decision: "refuse",
    code: "limit",
  })
  expect(untouched.order).toEqual([])
})
