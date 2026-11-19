import { expect, it } from "vitest"
import {
  appendIndex,
  format,
  decide,
  openRegister,
  slideId,
  gridGroups,
  readSlideState,
  slideUndoable,
  undoOf,
  redoOf,
  slideGroups,
  type Register,
  type SlideCommand,
  type Undoable,
} from "@airdesign/document"
import { dumpTopics } from "./spec-dump.js"

async function specGraph(name: string) {
  const topic = decodeURIComponent(new URL(`../specs/${name}`, import.meta.url).pathname)
  const [dump] = await dumpTopics([{ name, topic, spec: "Grid.tla", config: "Grid.cfg" }])
  if (dump === undefined) throw new Error("dump")
  const states = new Map<string, { stage: number; cacheStage: number }>()
  const edges: { from: string; to: string; action: string }[] = []
  for (const line of dump.graph.split("\n")) {
    const state = line.match(/^(-?\d+) \[label="(.*)"/)
    if (state !== null) {
      const stage = state[2]!.match(/stage = (\d+)/)
      const cache = state[2]!.match(/cacheStage = (\d+)/)
      if (stage !== null && cache !== null)
        states.set(state[1]!, { stage: Number(stage[1]), cacheStage: Number(cache[1]) })
    }
    const edge = line.match(/^(-?\d+) -> (-?\d+) \[label="([^"]+)"/)
    if (edge !== null) edges.push({ from: edge[1]!, to: edge[2]!, action: edge[3]! })
  }
  return { states, edges }
}
const file = [1, 2, 3, 4, 5, 6].map((id) => slideId(String(id)))
const id = (n: number) => slideId(String(n))
const expected = [
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [[1, 2, 3, 4], [6]],
  [[1, 2, 3, 4, 7], [6]],
  [[1, 2, 3, 4, 7], [6]],
  [[1, 2, 3, 4]],
  [[1, 2, 3, 4], [6]],
  [[1, 2, 5, 3, 4], [6]],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 3, 4, 7],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 7, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 3, 4],
    [5, 6],
  ],
  [
    [1, 7, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 7, 3, 4],
    [5, 6],
  ],
  [[1, 2, 3, 4], [7], [5, 6]],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [[1, 2, 3, 4], [7], [5, 6]],
  [[1, 2, 3, 4], [5, 6], [7]],
  [
    [1, 2, 3, 4, 8],
    [5, 6],
  ],
  [[1, 2, 3, 4, 8], [7], [5, 6]],
  [
    [1, 2, 3, 4, 8],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [7, 8],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [7, 8],
    [5, 6],
  ],
  [
    [1, 2, 3, 4, 8],
    [5, 6],
  ],
  [
    [1, 2, 3, 4, 8],
    [5, 6],
  ],
  [
    [2, 3, 4],
    [5, 6],
  ],
  [
    [2, 3, 4],
    [5, 6],
  ],
  [[1, 2, 3, 4], [8], [7], [5, 6]],
  [[1, 2, 3, 4], [7], [5, 6]],
  [
    [2, 4],
    [5, 1, 3, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [2, 4],
    [5, 6],
    [1, 3],
  ],
  [
    [5, 6],
    [1, 2, 3, 4],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [5, 6],
    [1, 2, 3, 4],
  ],
  [
    [5, 7, 6],
    [1, 2, 3, 4],
  ],
  [
    [5, 7, 6],
    [1, 2, 3, 4],
  ],
  [
    [1, 2, 3, 4],
    [5, 7, 6],
  ],
  [
    [2, 4],
    [5, 1, 3, 6, 7],
  ],
  [
    [1, 2, 3, 4],
    [5, 6, 7],
  ],
  [[1, 2, 5, 6, 3, 4]],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [[2, 3, 4]],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 7, 8, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 7, 8, 6],
  ],
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [
    [1, 3],
    [4, 5, 6],
  ],
  [
    [1, 3],
    [4, 6],
  ],
  [
    [1, 3, 4],
    [5, 6],
  ],
  [
    [1, 4],
    [5, 6],
  ],
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [
    [2, 4],
    [1, 3, 5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [[1, 2, 3, 4], [6]],
  [
    [1, 2],
    [3, 4, 5, 6],
  ],
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [
    [1, 2, 3, 4],
    [5, 6],
  ],
  [[1, 3, 4, 5, 6]],
  [[1, 2, 3, 4], [7], [5, 6]],
  [[1, 2, 3, 4], [7], [5, 6, 8]],
  [[1, 3, 4], [7], [5, 6, 2, 8]],
  [[1, 2, 3, 4], [7], [5, 6, 8]],
  [[1, 2, 3, 4], [7], [5, 6, 8]],
  [[5, 6, 8], [1, 2, 3, 4], [7]],
  [
    [1, 2, 3, 4],
    [5, 6, 8],
  ],
  [[1], [3], [4, 5]],
  [[1], [3], [4, 5]],
]

type World = { register: Register; cache: Register; undo: readonly Undoable[]; redo: Undoable | null }
function step(world: World, action: string): World {
  if (action === "IndexSections" || action === "OpenNoSections" || action === "RowsNoSections") {
    const indexed = appendIndex(world.register.index, {
      format,
      once: "sections",
      offset: 0,
      total: 0,
      slides: file.map((id, position) => ({ id, position })),
      elements: [],
      sectionStarts: action === "IndexSections" ? [id(1), id(2), id(3), id(4)] : [],
    })
    if (!indexed.ok) throw new Error(indexed.refusal)
    return { ...world, register: { ...world.register, index: indexed.index } }
  }
  if (action === "Adopt") {
    const parsed = readSlideState(JSON.parse(JSON.stringify(world.register)))
    if (parsed === undefined) throw new Error("decode")
    const { index } = world.register
    return { ...world, cache: { ...openRegister("", ""), ...parsed, ...(index === undefined ? {} : { index }) } }
  }
  if (["RefuseHead", "RefuseFilledUndo", "RefuseRowUndo", "RefuseOldUndo"].includes(action)) {
    const undoable = world.undo.at(-1)
    if (undoable === undefined) throw new Error("undoable")
    expect(undoOf(world.register, undoable).ok).toBe(false)
    return world
  }
  if (action === "RefuseRedo") {
    if (world.redo === null) throw new Error("redoable")
    expect(redoOf(world.register, world.redo).ok).toBe(false)
    return world
  }
  if (action === "RefuseStaleRow" || action === "RefuseGroupAnchor") {
    const edit: SlideCommand = {
      slide: "move-many",
      grid: 1,
      ids: [id(5), id(6)],
      after: action === "RefuseGroupAnchor" ? id(5) : null,
      row: "keep",
    }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({
      decision: "refuse",
      code: action === "RefuseGroupAnchor" ? "dead" : "stale",
    })
    return world
  }
  if (action === "RefuseOldNewRow" || action === "RefuseOldPartRow") {
    const edit: SlideCommand =
      action === "RefuseOldNewRow"
        ? { slide: "move-many", grid: 1, ids: [id(3)], after: id(2), row: "new" }
        : { slide: "move-many", grid: 1, ids: [id(5), id(6)], after: null, row: "keep" }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({
      decision: "refuse",
      code: "stale",
    })
    return world
  }
  if (action === "RefuseDeadBefore") {
    const edit: SlideCommand = { slide: "move-many", grid: 1, ids: [id(4)], before: id(5), row: "before" }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({ decision: "refuse", code: "dead" })
    return world
  }
  if (action === "RefuseDeadBelow" || action === "RefuseCollision") {
    const edit: SlideCommand = { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(2), row: "new" }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({
      decision: "refuse",
      code: action === "RefuseDeadBelow" ? "dead" : "present",
    })
    return world
  }
  if (action === "RefuseWholeDeck" || action === "RefuseSetCollision") {
    const edit: SlideCommand =
      action === "RefuseWholeDeck"
        ? { slide: "remove-many", grid: 1, ids: [id(1), id(2), id(3), id(4), id(5), id(6)] }
        : {
            slide: "clone-many",
            grid: 1,
            copies: [
              { id: id(7), source: id(2) },
              { id: id(9), source: id(3) },
            ],
          }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({
      decision: "refuse",
      code: action === "RefuseWholeDeck" ? "dead" : "present",
    })
    return world
  }
  if (action.startsWith("Undo") || ["RedoBelow", "RedoRow", "OldUndoAfterThree"].includes(action)) {
    const undoable = ["RedoBelow", "RedoRow"].includes(action) ? (world.redo ?? undefined) : world.undo.at(-1)
    if (undoable === undefined) throw new Error("undoable")
    const undo = ["RedoBelow", "RedoRow"].includes(action)
      ? redoOf(world.register, undoable)
      : undoOf(world.register, undoable)
    if (!undo.ok) throw new Error("undo refused")
    let register = world.register
    for (const command of undo.commands) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    return ["RedoBelow", "RedoRow"].includes(action)
      ? { ...world, register, undo: [...world.undo, undoable], redo: null }
      : { ...world, register, undo: world.undo.slice(0, -1), redo: undoable }
  }
  const edits: Readonly<Record<string, SlideCommand>> = {
    FirstVersionOne: { slide: "remove", grid: 1, id: id(2) },
    FirstVersionTwo: { slide: "remove", grid: 2, id: id(2) },
    LaterVersionOne: { slide: "remove", grid: 1, id: id(5) },
    LaterVersionTwo: { slide: "remove", grid: 2, id: id(3) },
    MoveBefore: { slide: "move-many", grid: 1, ids: [id(4)], before: id(5), row: "before" },
    GroupBefore: { slide: "move-many", grid: 1, ids: [id(3), id(1)], before: id(5), row: "before" },
    SectionedMoveBefore: { slide: "move-many", grid: 2, ids: [id(3)], before: id(4), row: "before" },
    GroupSame: { slide: "move-many", grid: 1, ids: [id(3), id(1)], after: id(5), row: "same" },
    GroupNew: { slide: "move-many", grid: 1, ids: [id(3), id(1)], after: id(5), row: "new" },
    RowKeep: { slide: "move-many", grid: 1, ids: [id(6), id(5)], after: null, row: "keep" },
    EmptyRow: { slide: "move-many", grid: 1, ids: [id(6), id(5)], after: id(2), row: "same" },
    ForeignRowInsert: { slide: "add", grid: 1, id: id(7), after: id(5), layout: id(1), row: "same" },
    ForeignGroupGap: { slide: "add", grid: 1, id: id(7), after: id(6), layout: id(1), row: "same" },
    DeleteSet: { slide: "remove-many", grid: 1, ids: [id(6), id(5), id(1)] },
    CloneSet: {
      slide: "clone-many",
      grid: 1,
      copies: [
        { id: id(8), source: id(5) },
        { id: id(7), source: id(2) },
      ],
    },
    RemoveNonHead: { slide: "remove", grid: 1, id: id(2) },
    RemoveHead: { slide: "remove", grid: 1, id: id(5) },
    RemoveSingleton: { slide: "remove", grid: 1, id: id(6) },
    RemoveAnchor: { slide: "remove", grid: 1, id: id(1) },
    MoveHead: { slide: "move", grid: 1, id: id(5), after: id(2), row: "same" },
    Clone: { slide: "clone", grid: 1, id: id(7), source: id(5) },
    Add: { slide: "add", grid: 1, id: id(7), after: id(4), layout: id(1), row: "same" },
    InsertGap: { slide: "add", grid: 1, id: id(7), after: id(4), layout: id(1), row: "same" },
    InsertNonHeadGap: { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(1), row: "same" },
    BelowInterior: { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(1), row: "new" },
    BelowFinal: { slide: "add", grid: 1, id: id(7), after: id(5), layout: id(1), row: "new" },
    TailAppend: { slide: "add", grid: 1, id: id(8), after: id(4), layout: id(1), row: "same" },
    BelowAfterAppend: { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(1), row: "new" },
    ForeignFillNew: { slide: "add", grid: 1, id: id(8), after: id(7), layout: id(1), row: "same" },
    AppendAfterUndo: { slide: "add", grid: 1, id: id(8), after: id(4), layout: id(1), row: "same" },
    TwoBelow: { slide: "add", grid: 1, id: id(8), after: id(2), layout: id(1), row: "new" },
    FirstVersionThree: { slide: "remove", grid: 3, id: id(2) },
    ThreeKeepsMadeRows: { slide: "add", grid: 3, id: id(8), after: id(6), layout: id(1), row: "same" },
    OldMoveAfterThree: { slide: "move", grid: 1, id: id(2), after: id(6), row: "same" },
    OldWholeGroup: { slide: "move-many", grid: 1, ids: [id(5), id(6), id(8)], after: null, row: "keep" },
    ThreeAfterTwo: { slide: "remove", grid: 3, id: id(6) },
  }
  const edit = edits[action]
  if (edit === undefined) throw new Error(`unknown edge ${action}`)
  const undoable = slideUndoable(world.register, file, edit)
  const answer = decide(world.register, { command: "slide", file, edit })
  if (answer.decision !== "apply" || undoable === null) throw new Error("edit")
  return {
    ...world,
    register: answer.register,
    undo:
      action.startsWith("Insert") ||
      [
        "TailAppend",
        "ForeignFillNew",
        "AppendAfterUndo",
        "ForeignRowInsert",
        "ForeignGroupGap",
        "ThreeKeepsMadeRows",
        "ThreeAfterTwo",
      ].includes(action)
        ? world.undo
        : [...world.undo, undoable],
  }
}
it("replays every bounded Grid edge through the joint fold and guarded inverses", async () => {
  const graph = await specGraph("grid")
  const initial = [...graph.states].find(([, state]) => state.stage === 0 && state.cacheStage === 0)
  if (initial === undefined) throw new Error("initial")
  const register = { ...openRegister("", ""), file }
  const worlds = new Map<string, World>([[initial[0], { register, cache: register, undo: [], redo: null }]])
  const queue = [initial[0]]
  let edges = 0
  while (queue.length > 0) {
    const from = queue.shift()!
    for (const edge of graph.edges.filter((edge) => edge.from === from && edge.action !== "Stuttering")) {
      const world = worlds.get(from)!
      const state = graph.states.get(edge.to)!
      const actions = [
        "",
        "RemoveHead",
        "InsertGap",
        "RefuseHead",
        "RemoveSingleton",
        "UndoSingleton",
        "MoveHead",
        "UndoMove",
        "Add",
        "Clone",
        "UndoAdd",
        "UndoClone",
        "RemoveNonHead",
        "InsertNonHeadGap",
        "UndoNonHead",
        "BelowInterior",
        "UndoBelow",
        "RedoBelow",
        "BelowFinal",
        "TailAppend",
        "BelowAfterAppend",
        "UndoConcurrentBelow",
        "ForeignFillNew",
        "RefuseFilledUndo",
        "AppendAfterUndo",
        "RefuseRedo",
        "RemoveAnchor",
        "RefuseDeadBelow",
        "TwoBelow",
        "RefuseCollision",
        "GroupSame",
        "UndoGroup",
        "GroupNew",
        "RowKeep",
        "UndoRow",
        "RedoRow",
        "ForeignRowInsert",
        "RefuseRowUndo",
        "RefuseStaleRow",
        "ForeignGroupGap",
        "UndoForeignGroup",
        "EmptyRow",
        "RefuseGroupAnchor",
        "DeleteSet",
        "UndoDeleteSet",
        "CloneSet",
        "UndoCloneSet",
        "RefuseWholeDeck",
        "RefuseSetCollision",
        "IndexSections",
        "FirstVersionTwo",
        "LaterVersionOne",
        "FirstVersionOne",
        "LaterVersionTwo",
        "MoveBefore",
        "UndoBefore",
        "GroupBefore",
        "UndoGroupBefore",
        "RefuseDeadBefore",
        "SectionedMoveBefore",
        "UndoSectionedBefore",
        "OpenNoSections",
        "FirstVersionThree",
        "RowsNoSections",
        "ThreeKeepsMadeRows",
        "OldMoveAfterThree",
        "RefuseOldNewRow",
        "RefuseOldPartRow",
        "OldWholeGroup",
        "OldUndoAfterThree",
        "ThreeAfterTwo",
        "RefuseOldUndo",
      ]
      const named = ["Land", "LandThree", "IndexNoSections"].includes(edge.action)
      const next = step(world, named ? actions[state.stage]! : edge.action)
      expect(gridGroups(next.register).map((row) => row.map(Number))).toEqual(expected[state.stage])
      expect(gridGroups(next.cache).map((row) => row.map(Number))).toEqual(expected[state.cacheStage])
      for (const register of [next.register, next.cache])
        if (register.order.some((command) => command.grid === 3))
          expect(slideGroups(register).map((group) => group.slides)).toEqual(gridGroups(register))
      edges++
      if (!worlds.has(edge.to)) {
        worlds.set(edge.to, next)
        queue.push(edge.to)
      }
    }
  }
  expect(worlds.size).toBe(graph.states.size)
  expect(edges).toBe(graph.edges.filter((edge) => edge.action !== "Stuttering").length)
}, 600_000)
