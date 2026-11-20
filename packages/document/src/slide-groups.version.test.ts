import { describe, expect, it } from "vitest"
import { appendIndex } from "./deck-index.js"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId, type SlideId } from "./element-id.js"
import { format } from "./format.js"
import { gridCommandVersion, gridGroups } from "./grid-order.js"
import { slideUndoable, undoOf } from "./person-undo.js"
import { presentSlides, readSlideState, type SlideCommand } from "./slide-order.js"
import { slideGroups } from "./slide-groups.js"

const id = (n: number) => slideId(String(n))
const deck = (count: number) => Array.from({ length: count }, (_, index) => id(256 + index))

function opened(file: readonly SlideId[], sectionStarts: readonly SlideId[]): Register {
  return { ...openRegister("", ""), file, sectionStarts }
}

function land(register: Register, ...edits: readonly SlideCommand[]): Register {
  let current = register
  for (const edit of edits) {
    const result = decide(current, { command: "slide", file: current.file, edit })
    if (result.decision !== "apply") throw new Error(result.code)
    current = result.register
  }
  return current
}

function seen(register: Register) {
  return {
    order: presentSlides(register).map((spot) => [spot.id, spot.key]),
    rows: gridGroups(register),
    groups: slideGroups(register),
  }
}

function sameAsVersionThree(register: Register, edit: SlideCommand) {
  const old = decide(register, { command: "slide", file: register.file, edit })
  const today = decide(register, { command: "slide", file: register.file, edit: { ...edit, grid: 3 } as SlideCommand })
  if (old.decision !== "apply" || today.decision !== "apply") throw new Error("refused")
  expect(seen(old.register)).toEqual(seen(today.register))
}

const switched = () => land(opened(deck(12), [id(256), id(260)]), { slide: "remove", grid: 3, id: id(267) })

describe("an older command folded after a version three command", () => {
  it("plans new commands against slide groups once the section starts are known or the log holds one", () => {
    expect(gridCommandVersion({ order: [] })).toBe(1)
    const sectioned = gridCommandVersion(opened(deck(12), [id(256)]))
    expect(sectioned).toBeGreaterThan(2)
    expect(gridCommandVersion(switched())).toBe(sectioned)
  })

  it.each<[string, SlideCommand]>([
    [
      "an add in the anchor's row",
      { slide: "add", grid: 2, row: "same", id: id(300), after: id(258), layout: id(256) },
    ],
    ["a move after an anchor", { slide: "move", grid: 1, id: id(257), after: id(262), row: "same" }],
    ["a group joining a row", { slide: "move-many", grid: 2, ids: [id(257), id(263)], after: id(261), row: "same" }],
    [
      "a group joining the start of a row",
      { slide: "move-many", grid: 1, ids: [id(263)], before: id(260), row: "before" },
    ],
    ["a group starting the deck", { slide: "move-many", grid: 2, ids: [id(262)], after: null, row: "new" }],
    [
      "a whole group moved first",
      {
        slide: "move-many",
        grid: 2,
        ids: [id(260), id(261), id(262), id(263), id(264), id(265), id(266)],
        after: null,
        row: "keep",
      },
    ],
    ["a duplicate", { slide: "clone", grid: 1, id: id(300), source: id(259) }],
    [
      "a set of duplicates",
      {
        slide: "clone-many",
        grid: 2,
        copies: [
          { id: id(300), source: id(257) },
          { id: id(301), source: id(261) },
        ],
      },
    ],
    ["a removal of a group's first slide", { slide: "remove", grid: 2, id: id(260) }],
    ["a removal of a set", { slide: "remove-many", grid: 1, ids: [id(256), id(261)] }],
  ])("lands %s with the meaning it has as version three", (_, edit) => {
    sameAsVersionThree(switched(), edit)
  })

  it.each<[string, SlideCommand]>([
    [
      "an add in a new row below an anchor",
      { slide: "add", grid: 2, row: "new", id: id(300), after: id(257), layout: id(256) },
    ],
    [
      "a group moved to a new row below an anchor",
      { slide: "move-many", grid: 1, ids: [id(257)], after: id(261), row: "new" },
    ],
    [
      "a whole group moved below an anchor",
      { slide: "move-many", grid: 2, ids: [id(256), id(257), id(258), id(259)], after: id(266), row: "keep" },
    ],
    [
      "a row that is not a whole slide group",
      { slide: "move-many", grid: 2, ids: [id(260), id(261)], after: null, row: "keep" },
    ],
  ])("refuses %s as stale, since its place depended on a row", (_, edit) => {
    const register = switched()
    expect(decide(register, { command: "slide", file: register.file, edit })).toMatchObject({
      decision: "refuse",
      code: "stale",
    })
  })

  it("lands an undo planned against slide groups whose heads still match, and refuses one whose heads do not", () => {
    const start = land(opened(deck(12), []), { slide: "remove", grid: 1, id: id(266) })
    const plan = (register: Register, edit: SlideCommand) => {
      const undoable = slideUndoable(register, register.file, edit)
      if (undoable === null) throw new Error("undoable")
      const after = land(register, edit)
      const undo = undoOf(after, undoable)
      if (!undo.ok) throw new Error("undo")
      return { after, undo: undo.commands[0]! }
    }
    const added = plan(start, { slide: "add", grid: 1, row: "new", id: id(300), after: id(257), layout: id(256) })
    const kept = land(added.after, { slide: "remove", grid: 3, id: id(256) })
    const undone = decide(kept, added.undo)
    if (undone.decision !== "apply") throw new Error(undone.code)
    expect(presentSlides(undone.register).some((spot) => spot.id === "300")).toBe(false)
    expect(gridGroups(undone.register).map((row) => row.map(Number))).toEqual([
      [257, 258, 259, 260],
      [261, 262, 263, 264, 265, 267],
    ])
    const removed = plan(start, { slide: "remove", grid: 1, id: id(261) })
    const regrouped = land(removed.after, { slide: "remove", grid: 3, id: id(267) })
    expect(decide(regrouped, removed.undo)).toMatchObject({ decision: "refuse", code: "stale" })
  })
})

describe("two tabs: an old tab's offline edits reach a deck a new tab regrouped", () => {
  const file = deck(10)
  const server = opened(file, [])
  const offline: readonly SlideCommand[] = [
    { slide: "add", grid: 1, row: "same", id: id(300), after: id(258), layout: id(256) },
    { slide: "add", grid: 1, row: "new", id: id(301), after: id(262), layout: id(256) },
    { slide: "remove", grid: 1, id: id(264) },
  ]

  const regroup: SlideCommand = { slide: "add", grid: 3, row: "same", id: id(400), after: id(265), layout: id(256) }
  const answers = (register: Register, edits: readonly SlideCommand[]) => {
    let current = register
    const codes = edits.map((edit) => {
      const answer = decide(current, { command: "slide", file, edit })
      if (answer.decision !== "apply") return answer.code
      current = answer.register
      return "apply"
    })
    return { codes, current }
  }

  it("lands what keeps its meaning and refuses a new slide group once the deck is regrouped", () => {
    expect(gridGroups(land(server, ...offline)).map((row) => row.map(Number))).toEqual([
      [256, 257, 258, 300, 259],
      [260, 261, 262, 263],
      [301],
      [265],
    ])
    const { codes, current } = answers(land(server, regroup), offline)
    expect(codes).toEqual(["apply", "stale", "apply"])
    expect(slideGroups(current).map((group) => group.slides.map(Number))).toEqual([
      [256, 257, 258, 300, 259, 260, 261, 262, 263, 265, 400],
    ])
    const decoded = readSlideState(JSON.parse(JSON.stringify(current)))
    if (decoded === undefined) throw new Error("decode")
    expect(slideGroups({ ...decoded, sectionStarts: [] })).toEqual(slideGroups(current))
  })

  it("keeps the old tab's new slide group as a slide group when its edits arrive first", () => {
    const { codes, current } = answers(server, [...offline, regroup])
    expect(codes).toEqual(["apply", "apply", "apply", "apply"])
    expect(slideGroups(current).map((group) => [group.key, ...group.slides.map(Number)])).toEqual([
      ["f0", 256, 257, 258, 300, 259, 260, 261, 262, 263],
      ["n1", 301],
      ["r265", 265, 400],
    ])
  })
})

describe("frozen recorded logs", () => {
  const page = {
    once: "opening",
    offset: 0,
    total: 0,
    slides: deck(6).map((slide, position) => ({ id: slide, position })),
    elements: [],
  }

  it("still folds the recorded version one log to the same slide groups and reads its slide groups", () => {
    const state = readSlideState({
      file: ["256", "257", "258", "259", "260", "261"],
      order: [{ id: "257", grid: 1, slide: "remove" }],
    })
    if (state === undefined) throw new Error("grid command")
    const index = appendIndex(undefined, { ...page, format, sectionStarts: [id(256), id(259)] })
    if (!index.ok) throw new Error(index.refusal)
    const frozen = [
      ["256", "258", "259"],
      ["260", "261"],
    ]
    expect(gridGroups(state)).toEqual(frozen)
    expect(gridGroups({ ...state, index: index.index })).toEqual(frozen)
    expect(slideGroups(state).map((group) => [group.key, ...group.slides])).toEqual([
      ["f0", "256", "258", "259", "260", "261"],
    ])
    expect(slideGroups({ ...state, index: index.index }, ["Intro", "Results"])).toEqual([
      { key: "f0", name: "Intro", slides: ["256", "258"] },
      { key: "f1", name: "Results", slides: ["259", "260", "261"] },
    ])
  })

  it("still folds the recorded version two log to the same slide groups and keeps its packed sections", () => {
    const state = readSlideState({
      file: ["256", "257", "258", "259", "260", "261"],
      sectionStarts: ["256", "257", "258", "259"],
      order: [{ id: "257", grid: 2, slide: "remove" }],
    })
    if (state === undefined) throw new Error("grid command")
    const index = appendIndex(undefined, { ...page, format, sectionStarts: [id(256), id(257), id(258), id(259)] })
    if (!index.ok) throw new Error(index.refusal)
    const indexed = { ...state, index: index.index }
    expect(gridGroups(indexed)).toEqual([
      ["256", "258"],
      ["259", "260", "261"],
    ])
    expect(slideGroups(indexed).map((group) => [group.key, ...group.slides])).toEqual([
      ["f0", "256"],
      ["f2", "258"],
      ["f3", "259", "260", "261"],
    ])
  })
})
