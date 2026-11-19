import { expect, it } from "vitest"
import { answeredRegister } from "./answered-register.js"
import { format } from "./format.js"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId } from "./element-id.js"
import { gridGroups } from "./grid-order.js"
import { redoOf, slideUndoable, undoOf } from "./person-undo.js"
import { readSlideState, type SlideCommand } from "./slide-order.js"
import { foldSections } from "./section-order.js"

const file = Array.from({ length: 10 }, (_, i) => slideId(String(i + 1)))
const opened = (): Register => ({ ...openRegister("", ""), file })
function move(ids: number[], after: number | null, row: string): SlideCommand {
  const edit = readSlideState({
    file,
    order: [{ slide: "move-many", grid: 1, ids: ids.map(String), after: after === null ? null : String(after), row }],
  })?.order[0]
  if (edit === undefined) throw new Error("move-many was not decoded")
  return edit
}
function apply(register: Register, edit: SlideCommand): Register {
  const result = decide(register, { command: "slide", file, edit })
  if (result.decision !== "apply") throw new Error(result.code)
  return result.register
}
function turn(register: Register, result: ReturnType<typeof undoOf>): Register {
  if (!result.ok) throw new Error("turn")
  for (const command of result.commands) {
    const answer = decide(register, command)
    if (answer.decision !== "apply") throw new Error(answer.code)
    register = answer.register
  }
  return register
}
it("moves a non-contiguous group in presentation order in one command and one inverse", () => {
  const before = opened(),
    edit = move([5, 1, 3], 9, "same")
  const undoable = slideUndoable(before, file, edit)
  if (undoable === null) throw new Error("undoable")
  const after = apply(before, edit)
  expect(after.order).toHaveLength(1)
  expect(gridGroups(after)).toEqual([
    ["2", "4"],
    ["6", "7", "8"],
    ["9", "1", "3", "5", "10"],
  ])
  const undone = undoOf(after, undoable)
  if (!undone.ok) throw new Error("undo")
  expect(undone.commands).toHaveLength(1)
  const restored = turn(after, undone)
  expect(gridGroups(restored)).toEqual(gridGroups(before))
  expect(gridGroups(turn(restored, redoOf(restored, undoable)))).toEqual(gridGroups(after))
})
function beforeMove(ids: string[], before: string) {
  const edit = readSlideState({ file, order: [{ slide: "move-many", grid: 1, ids, row: "before", before }] })?.order[0]
  if (edit === undefined) throw new Error("row start was not decoded")
  return edit
}

it("prepends at the slide group boundary with unchanged slide order and one undo", () => {
  const before = opened()
  const edit = beforeMove(["4"], "5")
  const undoable = slideUndoable(before, file, edit)
  if (undoable === null) throw new Error("undoable")
  const after = apply(before, edit)
  expect(after.order).toEqual([edit])
  expect(gridGroups(after)).toEqual([file.slice(0, 3), file.slice(3, 8), file.slice(8)])
  expect(gridGroups(turn(after, undoOf(after, undoable)))).toEqual(gridGroups(before))
})

it("fences a version-one before move in a server answer without an index", () => {
  const register = apply(opened(), beforeMove(["4"], "5"))
  expect(answeredRegister(register).format).toBe(format)
})

it("prepends multiple slides in deck order after removing their empty source slide group", () => {
  const edit = beforeMove(["10", "9"], "5")
  const after = apply(opened(), edit)
  expect(gridGroups(after)).toEqual([file.slice(0, 4), [...file.slice(8), ...file.slice(4, 8)]])
  expect(readSlideState(JSON.parse(JSON.stringify({ file, order: after.order })))).toEqual({ file, order: [edit] })
})

it("refuses a held or absent before anchor and an ambiguous encoding", () => {
  for (const edit of [beforeMove(["4"], "4"), beforeMove(["4"], "11")]) {
    expect(decide(opened(), { command: "slide", file, edit })).toMatchObject({ decision: "refuse", code: "dead" })
  }
  const edit = { slide: "move-many", grid: 1, ids: ["4"], row: "before" }
  for (const order of [[edit], [{ ...edit, before: null }], [{ ...edit, before: "5", after: null }]])
    expect(readSlideState({ file, order })).toBeUndefined()
})

it("extracts before resolving a new slide group's remaining tail and removes empty source slide groups", () => {
  expect(gridGroups(apply(opened(), move([8, 5, 6, 7, 4], 1, "new")))).toEqual([
    ["1", "2", "3"],
    ["4", "5", "6", "7", "8"],
    ["9", "10"],
  ])
  expect(gridGroups(apply(opened(), move([5, 6], null, "new")))).toEqual([
    ["5", "6"],
    ["1", "2", "3", "4"],
    ["7", "8"],
    ["9", "10"],
  ])
})
it("keeps one complete slide group and refuses a stale slide group or selected anchor atomically", () => {
  const edit = move([8, 6, 5, 7], 9, "keep")
  expect(gridGroups(apply(opened(), edit))).toEqual([
    ["1", "2", "3", "4"],
    ["9", "10"],
    ["5", "6", "7", "8"],
  ])
  const foreign = apply(opened(), {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("11"),
    after: slideId("6"),
    layout: slideId("1"),
  })
  expect(decide(foreign, { command: "slide", file, edit })).toMatchObject({ decision: "refuse", code: "stale" })
  expect(decide(opened(), { command: "slide", file, edit: move([1, 5], 9, "keep") })).toMatchObject({
    decision: "refuse",
    code: "stale",
  })
  expect(decide(opened(), { command: "slide", file, edit: move([1, 5], 1, "same") })).toMatchObject({
    decision: "refuse",
    code: "dead",
  })
})
it("guards whole slide group undo on the server after a foreign insertion", () => {
  const before = opened(),
    edit = move([5, 6, 7, 8], 9, "keep")
  const undoable = slideUndoable(before, file, edit)
  if (undoable === null) throw new Error("undoable")
  const moved = apply(before, edit),
    inverse = undoOf(moved, undoable)
  if (!inverse.ok || inverse.commands[0] === undefined) throw new Error("inverse")
  const foreign = apply(moved, {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("11"),
    after: slideId("6"),
    layout: slideId("1"),
  })
  expect(decide(foreign, inverse.commands[0])).toMatchObject({ decision: "refuse", code: "stale" })
  expect(undoOf(foreign, undoable).ok).toBe(false)
})
it("undoes a group after an independent foreign gap insertion", () => {
  const before = opened(),
    edit = move([2, 6], 9, "same")
  const undoable = slideUndoable(before, file, edit)
  if (undoable === null) throw new Error("undoable")
  const foreign = apply(apply(before, edit), {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("11"),
    after: slideId("3"),
    layout: slideId("1"),
  })
  expect(gridGroups(turn(foreign, undoOf(foreign, undoable)))).toEqual([
    ["1", "2", "3", "11", "4"],
    ["5", "6", "7", "8"],
    ["9", "10"],
  ])
})
it("inherits section membership when a complete slide group crosses a named boundary", () => {
  const after = apply(opened(), move([1, 2, 3, 4], 9, "keep"))
  expect(
    foldSections(after, [
      { name: "Opening", slides: ["1", "2", "3", "4"] },
      { name: "Results", slides: ["5", "6", "7", "8", "9", "10"] },
    ]),
  ).toEqual([
    { name: "Opening", slides: [] },
    { name: "Results", slides: ["5", "6", "7", "8", "9", "10", "1", "2", "3", "4"] },
  ])
})

it("refuses invalid group encodings and leaves absent members unchanged", () => {
  const base = { slide: "move-many", grid: 1, ids: ["1"], after: null, row: "same" }
  for (const ids of [[], ["1", "1"], ["no"], Array.from({ length: 51 }, (_, i) => String(i + 1))])
    expect(readSlideState({ file, order: [{ ...base, ids }] })).toBeUndefined()
  const before = opened()
  expect(decide(before, { command: "slide", file, edit: move([1, 11], null, "same") })).toMatchObject({
    decision: "refuse",
    code: "dead",
  })
  expect(before.order).toEqual([])
})
it("guards slide group redo against a foreign insertion in the restored source slide group", () => {
  const before = opened(),
    edit = move([5, 6, 7, 8], null, "keep")
  const undoable = slideUndoable(before, file, edit)
  if (undoable === null) throw new Error("undoable")
  const moved = apply(before, edit),
    restored = turn(moved, undoOf(moved, undoable))
  const forward = redoOf(restored, undoable)
  if (!forward.ok || forward.commands[0] === undefined) throw new Error("redo")
  const foreign = apply(restored, {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("11"),
    after: slideId("6"),
    layout: slideId("1"),
  })
  expect(decide(foreign, forward.commands[0])).toMatchObject({ decision: "refuse", code: "stale" })
})
