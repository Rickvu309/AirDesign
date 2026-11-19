import { describe, expect, it } from "vitest"
import { decide, openRegister } from "./decide.js"
import { slideId } from "./element-id.js"
import { defaultGrid1, gridGroups } from "./grid-order.js"
import { presentSlides } from "./slide-order.js"

const file = Array.from({ length: 10 }, (_, i) => slideId(String(256 + i)))

describe("stored grid slide groups", () => {
  it("freezes the ten-slide prefix before the eleventh slide", () => {
    const result = decide(openRegister("", ""), {
      command: "slide",
      file,
      edit: { slide: "add", grid: 1, row: "same", id: slideId("266"), after: file[9]!, layout: file[0]! },
    })
    if (result.decision !== "apply") throw new Error(result.code)
    expect(gridGroups(result.register)).toEqual([file.slice(0, 4), file.slice(4, 8), [...file.slice(8), "266"]])
    expect(presentSlides(result.register).map((s) => s.id)).toEqual([...file, "266"])
  })
  it("freezes the version-one default fixture", () => {
    const columns = [
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9,
    ]
    for (const [count, width] of columns.entries()) {
      const ids = Array.from({ length: count }, (_, index) => slideId(String(index + 1)))
      expect(defaultGrid1(ids)).toEqual({ starts: ids.filter((_, index) => index % width === 0) })
    }

    expect(defaultGrid1(file)).toEqual({ starts: ["256", "260", "264"] })
    expect(defaultGrid1(Array.from({ length: 50 }, (_, i) => slideId(String(i + 1))))).toEqual({
      starts: ["1", "10", "19", "28", "37", "46"],
    })
  })
})

function apply(register: ReturnType<typeof openRegister>, edit: import("./slide-order.js").SlideCommand, known = file) {
  const result = decide(register, { command: "slide", file: known, edit })
  if (result.decision !== "apply") throw new Error(result.code)
  return result.register
}

function initial(known = file): ReturnType<typeof openRegister> {
  return { ...openRegister("", ""), file: known }
}

function remove(register: ReturnType<typeof openRegister>, id: string, known = file) {
  return apply(register, { slide: "remove", grid: 1, id: slideId(id) }, known)
}

function rows(register: ReturnType<typeof openRegister>) {
  return gridGroups(register)
}

import { undoOf, redoOf, slideUndoable } from "./person-undo.js"
import { orderKeyAfter, readSlideState } from "./slide-order.js"

describe("grid lifecycle and conditional undo", () => {
  it("initializes at the first tagged prefix after legacy edits", () => {
    const opened = initial()
    const key = orderKeyAfter(presentSlides(opened), file[0]!)
    if (key === null) throw new Error("key")
    const legacy = apply(opened, { slide: "clone", id: slideId("266"), source: file[0]!, key })
    const before = defaultGrid1(presentSlides(legacy).map((spot) => spot.id))
    const edited = remove(legacy, "257")
    expect(rows(edited).map((row) => row[0])).toEqual(before.starts)
    expect(edited.order[0]).not.toHaveProperty("grid")
    expect(edited.order[1]).toHaveProperty("grid", 1)
  })

  for (const edit of [
    { slide: "remove", id: slideId("260"), grid: 1 },
    { slide: "move", id: slideId("260"), after: slideId("257"), row: "same", grid: 1 },
    { slide: "clone", id: slideId("266"), source: slideId("259"), grid: 1 },
    { slide: "add", id: slideId("266"), after: slideId("259"), layout: slideId("256"), row: "same", grid: 1 },
  ] satisfies import("./slide-order.js").SlideCommand[]) {
    it("undoes and redoes " + edit.slide + " with its head bits", () => {
      const opened = initial()
      const undoable = slideUndoable(opened, file, edit)
      if (undoable === null) throw new Error("undoable")
      const changed = apply(opened, edit)
      const parsed = readSlideState(JSON.parse(JSON.stringify(changed)))
      expect(parsed?.order).toEqual(changed.order)
      const undo = undoOf(changed, undoable)
      if (!undo.ok) throw new Error("undo")
      let restored = changed
      for (const command of undo.commands) {
        const answer = decide(restored, command)
        if (answer.decision !== "apply") throw new Error(answer.code)
        restored = answer.register
      }
      expect(rows(restored)).toEqual(rows(opened))
      expect(restored.order.some((command) => command.grid === 1)).toBe(true)
      const redo = redoOf(restored, undoable)
      if (!redo.ok) throw new Error("redo")
      for (const command of redo.commands) {
        const answer = decide(restored, command)
        if (answer.decision !== "apply") throw new Error(answer.code)
        restored = answer.register
      }
      expect(rows(restored)).toEqual(rows(changed))
    })
  }

  it("promotes a removed head within its slide group and drops an empty slide group", () => {
    let state = remove(initial(), "260")
    expect(rows(state)).toEqual([file.slice(0, 4), file.slice(5, 8), file.slice(8)])
    state = remove(remove(remove(state, "261"), "262"), "263")
    expect(rows(state)).toEqual([file.slice(0, 4), file.slice(8)])
  })
  it("moves a head without carrying its boundary", () => {
    const moved = apply(initial(), { slide: "move", grid: 1, id: slideId("260"), after: slideId("257"), row: "same" })
    expect(rows(moved)).toEqual([
      ["256", "257", "260", "258", "259"],
      ["261", "262", "263"],
      ["264", "265"],
    ])
  })
  it("restores a deleted slide after another person inserts in the gap", () => {
    const opened = initial()
    const edit = { slide: "remove", grid: 1, id: slideId("257") } as const
    const undoable = slideUndoable(opened, file, edit)
    if (undoable === null) throw new Error("undoable")
    const deleted = apply(opened, edit)
    const foreign = apply(deleted, {
      slide: "add",
      grid: 1,
      row: "same",
      id: slideId("266"),
      after: slideId("256"),
      layout: slideId("256"),
    })
    const undo = undoOf(foreign, undoable)
    if (!undo.ok) throw new Error("undo")
    const result = decide(foreign, undo.commands[0]!)
    if (result.decision !== "apply") throw new Error(result.code)
    expect(presentSlides(result.register)).toHaveLength(11)
    expect(rows(result.register)[0]).toContain("266")
    expect(rows(result.register).slice(1)).toEqual(rows(opened).slice(1))
  })
  it("refuses singleton restoration if its successor was joined", () => {
    const known = file.slice(0, 9)
    let state: ReturnType<typeof openRegister> = initial(known)
    state = remove(state, "256", known)
    state = remove(state, "257", known)
    state = remove(state, "258", known)
    const edit = { slide: "remove", grid: 1, id: slideId("259") } as const
    const undoable = slideUndoable(state, known, edit)
    if (undoable === null) throw new Error("undoable")
    const deleted = apply(state, edit, known)
    const successor = rows(deleted)[0]?.[0]
    if (successor === undefined) throw new Error("successor")
    const moved = apply(deleted, { slide: "move", grid: 1, id: successor, after: slideId("264"), row: "same" }, known)
    expect(undoOf(moved, undoable).ok).toBe(false)
  })
  it("resolves two tabs on the accepted prefix and refuses colliding births", () => {
    const edit = { slide: "clone", grid: 1, id: slideId("266"), source: slideId("259") } as const
    const first = apply(initial(), edit)
    expect(decide(first, { command: "slide", file, edit })).toEqual({ decision: "refuse", code: "present" })
    const second = apply(first, { ...edit, id: slideId("267") })
    expect(rows(second)[0]).toEqual(["256", "257", "258", "259", "267", "266"])
    expect(rows(second).slice(1)).toEqual([file.slice(4, 8), file.slice(8)])
  })
  it("refuses the fifty-first slide without initializing or changing the log", () => {
    const known = Array.from({ length: 50 }, (_, i) => slideId(String(i + 1)))
    const state = initial(known)
    const snapshot = JSON.stringify(state)
    expect(
      decide(state, {
        command: "slide",
        file: known,
        edit: { slide: "clone", grid: 1, id: slideId("51"), source: known[0]! },
      }),
    ).toEqual({ decision: "refuse", code: "limit" })
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

it("guards singleton restoration on the server after a foreign join", () => {
  let state = initial()
  for (const id of ["261", "262", "263"]) state = remove(state, id)
  const edit = { slide: "remove", grid: 1, id: slideId("260") } as const
  const undoable = slideUndoable(state, file, edit)
  if (undoable === null) throw new Error("undoable")
  const deleted = apply(state, edit)
  const inverse = undoOf(deleted, undoable)
  if (!inverse.ok) throw new Error("inverse")
  const successor = presentSlides(deleted).find((spot) => spot.id === "264")!
  const joined = apply(deleted, {
    slide: "grid-turn",
    grid: 1,
    turn: {
      spots: [
        {
          id: successor.id,
          before: { present: true, key: successor.key },
          after: { present: true, key: successor.key },
        },
      ],
      heads: [{ id: successor.id, before: true, after: false }],
      rows: [],
    },
  })
  expect(decide(joined, inverse.commands[0]!)).toEqual({ decision: "refuse", code: "stale" })
  expect(undoOf(joined, undoable).ok).toBe(false)
})

it("maintains source heads for keyed writers after initialization", () => {
  const first = apply(initial(), { slide: "clone", grid: 1, id: slideId("266"), source: slideId("259") })
  const key = orderKeyAfter(presentSlides(first), slideId("265"))!
  const moved = apply(first, { slide: "move", id: slideId("260"), key })
  expect(rows(moved)).toEqual([
    ["256", "257", "258", "259", "266"],
    ["261", "262", "263"],
    ["264", "265", "260"],
  ])
})

it("rejects modern commands with redundant keyed placement or an unshipped slide group mode", () => {
  const command = { slide: "add", grid: 1, row: "same", id: "266", after: "259", layout: "256" }
  expect(readSlideState({ file, order: [{ ...command, key: "a0" }] })).toBeUndefined()
  expect(readSlideState({ file, order: [{ ...command, row: "keep" }] })).toBeUndefined()
  expect(
    readSlideState({ file, order: [{ slide: "move", grid: 1, row: "new", id: "266", after: "259" }] }),
  ).toBeUndefined()
  expect(readSlideState({ file, order: [{ ...command, grid: 4 }] })).toBeUndefined()
})

it("refuses a head restore that would take a foreign slide from the preceding slide group", () => {
  const edit = { slide: "remove", grid: 1, id: slideId("260") } as const
  const undoable = slideUndoable(initial(), file, edit)
  if (undoable === null) throw new Error("undoable")
  const deleted = apply(initial(), edit)
  const foreign = apply(deleted, {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("266"),
    after: slideId("259"),
    layout: slideId("256"),
  })
  expect(undoOf(foreign, undoable).ok).toBe(false)
})
it("restores a head while keeping a foreign insert in the same source slide group", () => {
  const edit = { slide: "remove", grid: 1, id: slideId("260") } as const
  const undoable = slideUndoable(initial(), file, edit)
  if (undoable === null) throw new Error("undoable")
  const deleted = apply(initial(), edit)
  const foreign = apply(deleted, {
    slide: "add",
    grid: 1,
    row: "same",
    id: slideId("266"),
    after: slideId("261"),
    layout: slideId("256"),
  })
  const undo = undoOf(foreign, undoable)
  if (!undo.ok) throw new Error("undo")
  const result = decide(foreign, undo.commands[0]!)
  if (result.decision !== "apply") throw new Error(result.code)
  expect(rows(result.register)[1]).toEqual(["260", "261", "266", "262", "263"])
})
