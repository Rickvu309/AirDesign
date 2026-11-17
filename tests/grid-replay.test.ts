import { expect, it } from "vitest"
import {
  decide,
  openRegister,
  slideId,
  gridRows,
  readSlideState,
  slideUndoable,
  undoOf,
  redoOf,
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
]

type World = { register: Register; cache: Register; undo: readonly Undoable[]; redo: Undoable | null }
function step(world: World, action: string): World {
  if (action === "Adopt") {
    const parsed = readSlideState(JSON.parse(JSON.stringify(world.register)))
    if (parsed === undefined) throw new Error("decode")
    return { ...world, cache: { ...openRegister("", ""), ...parsed } }
  }
  if (action === "RefuseHead" || action === "RefuseFilledUndo") {
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
  if (action === "RefuseDeadBelow" || action === "RefuseCollision") {
    const edit: SlideCommand = { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(2), row: "new" }
    expect(decide(world.register, { command: "slide", file, edit })).toMatchObject({
      decision: "refuse",
      code: action === "RefuseDeadBelow" ? "dead" : "present",
    })
    return world
  }
  if (action.startsWith("Undo") || action === "RedoBelow") {
    const undoable = action === "RedoBelow" ? (world.redo ?? undefined) : world.undo.at(-1)
    if (undoable === undefined) throw new Error("undoable")
    const undo = action === "RedoBelow" ? redoOf(world.register, undoable) : undoOf(world.register, undoable)
    if (!undo.ok) throw new Error("undo refused")
    let register = world.register
    for (const command of undo.commands) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    return action === "RedoBelow"
      ? { ...world, register, undo: [...world.undo, undoable], redo: null }
      : { ...world, register, undo: world.undo.slice(0, -1), redo: undoable }
  }
  const edits: Readonly<Record<string, SlideCommand>> = {
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
      action.startsWith("Insert") || ["TailAppend", "ForeignFillNew", "AppendAfterUndo"].includes(action)
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
      ]
      const next = step(world, edge.action === "Land" ? actions[state.stage]! : edge.action)
      expect(gridRows(next.register).map((row) => row.map(Number))).toEqual(expected[state.stage])
      expect(gridRows(next.cache).map((row) => row.map(Number))).toEqual(expected[state.cacheStage])
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
