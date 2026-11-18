import { describe, expect, it } from "vitest"
import { decide, openRegister, type Register } from "./decide.js"
import { slideId, type SlideId } from "./element-id.js"
import { gridRows } from "./grid-order.js"
import { orderKeyAfter, presentSlides, type SlideCommand } from "./slide-order.js"
import { foldSections } from "./section-order.js"
import { slideGroups } from "./slide-groups.js"
import { redoOf, slideUndoable, undoOf } from "./person-undo.js"

const id = (n: number) => slideId(String(n))
const deck = (count: number) => Array.from({ length: count }, (_, index) => id(256 + index))
const names = ["Intro", "Results"]

function opened(file: readonly SlideId[], sectionStarts?: readonly SlideId[]): Register {
  return { ...openRegister("", ""), file, ...(sectionStarts === undefined ? {} : { sectionStarts }) }
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

function turned(register: Register, turns: ReturnType<typeof undoOf>): Register {
  if (!turns.ok) throw new Error("turn")
  let current = register
  for (const command of turns.commands) {
    const result = decide(current, command)
    if (result.decision !== "apply") throw new Error(result.code)
    current = result.register
  }
  return current
}

function groups(register: Register, labels: readonly string[] = names) {
  return slideGroups(register, labels).map((group) => [group.key, group.name ?? null, ...group.slides.map(Number)])
}

const sectioned = () => opened(deck(7), [id(256), id(259)])

describe("the probe table: a sectioned deck rearranged in Grid", () => {
  it("opens as the file's sections", () => {
    expect(groups(sectioned())).toEqual([
      ["f0", "Intro", 256, 257, 258],
      ["f1", "Results", 259, 260, 261, 262],
    ])
  })

  it("puts the last Intro slide dragged to the start of the Results row into Results", () => {
    const moved = land(sectioned(), { slide: "move-many", grid: 2, ids: [id(258)], before: id(259), row: "before" })
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 257],
      ["f1", "Results", 258, 259, 260, 261, 262],
    ])
  })

  it("puts the first Results slide dragged to the end of the Intro row into Intro", () => {
    const moved = land(sectioned(), { slide: "move-many", grid: 2, ids: [id(259)], after: id(258), row: "same" })
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 257, 258, 259],
      ["f1", "Results", 260, 261, 262],
    ])
  })

  it("puts an Intro slide dragged into the middle of the Results row into Results", () => {
    const moved = land(sectioned(), { slide: "move-many", grid: 2, ids: [id(257)], after: id(260), row: "same" })
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 258],
      ["f1", "Results", 259, 260, 257, 261, 262],
    ])
  })

  it("makes an unnamed slide group of a slide moved to a new row", () => {
    const moved = land(sectioned(), { slide: "move-many", grid: 2, ids: [id(260)], after: id(262), row: "new" })
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 257, 258],
      ["f1", "Results", 259, 261, 262],
      ["n0", null, 260],
    ])
  })

  it("makes an unnamed slide group of a slide added in a new row below Intro", () => {
    const added = land(sectioned(), { slide: "add", grid: 2, row: "new", id: id(263), after: id(256), layout: id(256) })
    expect(groups(added)).toEqual([
      ["f0", "Intro", 256, 257, 258],
      ["n0", null, 263],
      ["f1", "Results", 259, 260, 261, 262],
    ])
  })

  it("keeps the Results name on the Results row moved above the Intro row", () => {
    const results = [id(259), id(260), id(261), id(262)] as const
    const moved = land(sectioned(), { slide: "move-many", grid: 2, ids: results, after: null, row: "keep" })
    expect(groups(moved)).toEqual([
      ["f1", "Results", 259, 260, 261, 262],
      ["f0", "Intro", 256, 257, 258],
    ])
  })
})

describe("older logs, as the design's section 4 table maps them", () => {
  it("reads a log with no grid command as today's exported sections", () => {
    const start = sectioned()
    const key = orderKeyAfter(presentSlides(start), id(260))
    if (key === null) throw new Error("key")
    const moved = land(start, { slide: "move", id: id(258), key })
    const base = [
      { name: "Intro", slides: ["256", "257", "258"] },
      { name: "Results", slides: ["259", "260", "261", "262"] },
    ]
    expect(groups(moved)).toEqual(
      foldSections(moved, base).map((section, k) => [`f${String(k)}`, section.name, ...section.slides.map(Number)]),
    )
  })

  it("reads a section with an empty name as an unnamed slide group", () => {
    expect(groups(sectioned(), ["", "Results"])).toEqual([
      ["f0", null, 256, 257, 258],
      ["f1", "Results", 259, 260, 261, 262],
    ])
  })

  it("reads a file with no sections as one slide group", () => {
    expect(groups(opened(deck(12)), [])).toEqual([["f0", null, ...deck(12).map(Number)]])
    expect(groups(opened(deck(12), []), [])).toEqual([["f0", null, ...deck(12).map(Number)]])
  })

  it("dissolves the rows that only wrapped a long section", () => {
    const file = deck(41)
    const starts = [file[0]!, file[1]!, file[29]!, file[39]!]
    const removed = land(opened(file, starts), { slide: "remove", grid: 2, id: file[40]! })
    expect(gridRows(removed).map((row) => row.length)).toEqual([1, 10, 10, 8, 10, 1])
    expect(slideGroups(removed).map((group) => [group.key, group.slides.length])).toEqual([
      ["f0", 1],
      ["f1", 28],
      ["f2", 10],
      ["f3", 1],
    ])
  })

  it("splits a wrapped section where a person made a row, and leaves the rest of it unnamed", () => {
    const file = deck(41)
    const starts = [file[0]!, file[1]!, file[29]!, file[39]!]
    const added = land(opened(file, starts), {
      slide: "add",
      grid: 2,
      row: "new",
      id: id(400),
      after: file[3]!,
      layout: file[0]!,
    })
    expect(slideGroups(added).map((group) => [group.key, group.slides[0], group.slides.length])).toEqual([
      ["f0", "256", 1],
      ["f1", "257", 10],
      ["n0", "400", 1],
      ["r267", "267", 18],
      ["f2", "285", 10],
      ["f3", "295", 2],
    ])
  })

  it("dissolves default rows on a deck with no sections and keeps the rows a person made", () => {
    const added = land(opened(deck(6)), {
      slide: "add",
      grid: 1,
      row: "new",
      id: id(300),
      after: id(256),
      layout: id(256),
    })
    expect(gridRows(added).map((row) => row.map(Number))).toEqual([[256, 257, 258, 259], [300], [260, 261]])
    expect(groups(added, [])).toEqual([
      ["f0", null, 256, 257, 258, 259],
      ["n0", null, 300],
      ["r260", null, 260, 261],
    ])
    expect(groups(land(opened(deck(6)), { slide: "remove", grid: 1, id: id(257) }), [])).toEqual([
      ["f0", null, 256, 258, 259, 260, 261],
    ])
  })

  it("makes an unnamed slide group of a default row moved whole", () => {
    const moved = land(opened(deck(10)), {
      slide: "move-many",
      grid: 1,
      ids: [id(260), id(261), id(262), id(263)],
      after: null,
      row: "keep",
    })
    expect(groups(moved, [])).toEqual([
      ["n0", null, 260, 261, 262, 263],
      ["f0", null, 256, 257, 258, 259, 264, 265],
    ])
  })

  it("keeps a section's name on a row a person made where that section starts, and leaves the rest unnamed", () => {
    const moved = land(sectioned(), { slide: "move-many", grid: 1, ids: [id(259)], after: id(258), row: "new" })
    expect(gridRows(moved).map((row) => row.map(Number))).toEqual([[256, 257, 258], [259], [260, 261, 262]])
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 257, 258],
      ["f1", "Results", 259],
      ["r260", null, 260, 261, 262],
    ])
  })

  it("reads version one rows on a sectioned deck as today's sections split where a person made a row", () => {
    const start = opened(deck(6), [id(256), id(259)])
    const added = land(start, { slide: "add", grid: 1, row: "new", id: id(300), after: id(257), layout: id(256) })
    expect(gridRows(added).map((row) => row.map(Number))).toEqual([[256, 257, 258, 259], [300], [260, 261]])
    expect(groups(added)).toEqual([
      ["f0", "Intro", 256, 257, 258],
      ["f1", "Results", 259],
      ["n0", null, 300],
      ["r260", null, 260, 261],
    ])
  })
})

describe("version three commands plan against slide groups", () => {
  it("fixes the groups of an older log at the first version three command", () => {
    const rows = land(opened(deck(6), []), {
      slide: "add",
      grid: 1,
      row: "new",
      id: id(300),
      after: id(256),
      layout: id(256),
    })
    const next = land(rows, { slide: "add", grid: 3, row: "same", id: id(301), after: id(261), layout: id(256) })
    expect(groups(next, [])).toEqual([
      ["f0", null, 256, 257, 258, 259],
      ["n0", null, 300],
      ["r260", null, 260, 261, 301],
    ])
    expect(gridRows(next)).toEqual(slideGroups(next).map((group) => group.slides))
  })

  it("dissolves default rows at the first version three command", () => {
    const next = land(opened(deck(10), []), { slide: "remove", grid: 3, id: id(257) })
    expect(gridRows(next)).toEqual([deck(10).filter((slide) => slide !== "257")])
  })

  it("adds a new slide group below the whole group, not below a line", () => {
    const next = land(opened(deck(12), []), {
      slide: "add",
      grid: 3,
      row: "new",
      id: id(300),
      after: id(257),
      layout: id(256),
    })
    expect(groups(next, [])).toEqual([
      ["f0", null, ...deck(12).map(Number)],
      ["n0", null, 300],
    ])
  })

  it("moves a whole slide group with its key and name", () => {
    const results = [id(259), id(260), id(261), id(262)] as const
    const moved = land(sectioned(), { slide: "move-many", grid: 3, ids: results, after: null, row: "keep" })
    expect(groups(moved)).toEqual([
      ["f1", "Results", 259, 260, 261, 262],
      ["f0", "Intro", 256, 257, 258],
    ])
  })

  it("hands the key and name to the next slide when a group's first slide leaves", () => {
    const moved = land(sectioned(), { slide: "move", grid: 3, id: id(259), after: id(257), row: "same" })
    expect(groups(moved)).toEqual([
      ["f0", "Intro", 256, 257, 259, 258],
      ["f1", "Results", 260, 261, 262],
    ])
  })

  it("keeps one named group of the same slides when its first slide moves to a later line of that group", () => {
    const start = opened(deck(41), [id(256), id(257), id(285), id(295)])
    const labels = ["Introduction", "Part 1", "Part 2", "Appendices"]
    const before = slideGroups(start, labels)
    const moved = land(start, { slide: "move-many", grid: 3, ids: [id(257)], after: id(279), row: "same" })
    const after = slideGroups(moved, labels)
    expect(after.map((group) => [group.key, group.name, group.slides.length])).toEqual([
      ["f0", "Introduction", 1],
      ["f1", "Part 1", 28],
      ["f2", "Part 2", 10],
      ["f3", "Appendices", 2],
    ])
    expect(after[1]!.slides[0]).toBe(id(258))
    expect(after[1]!.slides.indexOf(id(257))).toBe(22)
    expect(after[1]!.slides.toSorted()).toEqual(before[1]!.slides.toSorted())
  })

  it("brings a merged group's name back on undo, and ends it again on redo", () => {
    const start = sectioned()
    const edit = {
      slide: "move-many",
      grid: 3,
      ids: [id(259), id(260), id(261), id(262)],
      after: id(258),
      row: "same",
    } as const
    const undoable = slideUndoable(start, start.file, edit)
    if (undoable === null) throw new Error("undoable")
    const merged = land(start, edit)
    expect(groups(merged)).toEqual([["f0", "Intro", 256, 257, 258, 259, 260, 261, 262]])
    const undone = turned(merged, undoOf(merged, undoable))
    expect(groups(undone)).toEqual(groups(start))
    expect(groups(turned(undone, redoOf(undone, undoable)))).toEqual(groups(merged))
  })

  it("keeps a split-off group's key through undo and redo", () => {
    const start = land(sectioned(), { slide: "remove", grid: 3, id: id(262) })
    const edit = { slide: "move-many", grid: 3, ids: [id(257)], after: id(261), row: "new" } as const
    const undoable = slideUndoable(start, start.file, edit)
    if (undoable === null) throw new Error("undoable")
    const split = land(start, edit)
    expect(groups(split)).toEqual([
      ["f0", "Intro", 256, 258],
      ["f1", "Results", 259, 260, 261],
      ["n1", null, 257],
    ])
    const undone = turned(split, undoOf(split, undoable))
    expect(groups(undone)).toEqual(groups(start))
    expect(groups(turned(undone, redoOf(undone, undoable)))).toEqual(groups(split))
  })

  it("leaves a new slide group unnamed when its slide once headed a merged group", () => {
    const merged = land(sectioned(), {
      slide: "move-many",
      grid: 3,
      ids: [id(259), id(260), id(261), id(262)],
      after: id(258),
      row: "same",
    })
    const split = land(merged, { slide: "move-many", grid: 3, ids: [id(259)], after: id(262), row: "new" })
    expect(groups(split)).toEqual([
      ["f0", "Intro", 256, 257, 258, 260, 261, 262],
      ["n1", null, 259],
    ])
  })

  it("brings a deleted group back with its name on undo", () => {
    const start = sectioned()
    const edit = { slide: "remove-many", grid: 3, ids: [id(259), id(260), id(261), id(262)] } as const
    const undoable = slideUndoable(start, start.file, edit)
    if (undoable === null) throw new Error("undoable")
    const removed = land(start, edit)
    expect(groups(removed)).toEqual([["f0", "Intro", 256, 257, 258]])
    expect(groups(turned(removed, undoOf(removed, undoable)))).toEqual(groups(start))
  })

  it("refuses a version three command while the section starts are unknown", () => {
    const edit = { slide: "remove", grid: 3, id: id(257) } as const
    expect(decide(opened(deck(6)), { command: "slide", file: deck(6), edit })).toMatchObject({
      decision: "refuse",
      code: "stale",
    })
    expect(decide(opened(deck(6), []), { command: "slide", file: deck(6), edit })).toMatchObject({ decision: "apply" })
  })
})
