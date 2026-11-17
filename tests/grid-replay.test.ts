import { expect, it } from "vitest"
import {
  decide,
  openRegister,
  slideId,
  gridRows,
  readSlideState,
  slideUndoable,
  undoOf,
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
]

type World = { register: Register; cache: Register; undo: readonly Undoable[] }
function step(world: World, action: string): World {
  if (action === "Adopt") {
    const parsed = readSlideState(JSON.parse(JSON.stringify(world.register)))
    if (parsed === undefined) throw new Error("decode")
    return { ...world, cache: { ...openRegister("", ""), ...parsed } }
  }
  if (action === "RefuseHead") {
    const undoable = world.undo.at(-1)
    if (undoable === undefined) throw new Error("undoable")
    expect(undoOf(world.register, undoable).ok).toBe(false)
    return world
  }
  if (action.startsWith("Undo")) {
    const undoable = world.undo.at(-1)
    if (undoable === undefined) throw new Error("undoable")
    const undo = undoOf(world.register, undoable)
    if (!undo.ok) throw new Error("undo refused")
    let register = world.register
    for (const command of undo.commands) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    return { ...world, register, undo: world.undo.slice(0, -1) }
  }
  const edit: SlideCommand =
    action === "RemoveNonHead"
      ? { slide: "remove", grid: 1, id: id(2) }
      : action === "InsertNonHeadGap"
        ? { slide: "add", grid: 1, id: id(7), after: id(1), layout: id(1), row: "same" }
        : action === "RemoveHead"
          ? { slide: "remove", grid: 1, id: id(5) }
          : action === "RemoveSingleton"
            ? { slide: "remove", grid: 1, id: id(6) }
            : action === "MoveHead"
              ? { slide: "move", grid: 1, id: id(5), after: id(2), row: "same" }
              : action === "Clone"
                ? { slide: "clone", grid: 1, id: id(7), source: id(5) }
                : { slide: "add", grid: 1, id: id(7), after: id(4), layout: id(1), row: "same" }
  const undoable = slideUndoable(world.register, file, edit)
  const answer = decide(world.register, { command: "slide", file, edit })
  if (answer.decision !== "apply" || undoable === null) throw new Error("edit")
  return {
    ...world,
    register: answer.register,
    undo: action.startsWith("Insert") ? world.undo : [...world.undo, undoable],
  }
}
it("replays every bounded Grid edge through the joint fold and guarded inverses", async () => {
  const graph = await specGraph("grid")
  const initial = [...graph.states].find(([, state]) => state.stage === 0 && state.cacheStage === 0)
  if (initial === undefined) throw new Error("initial")
  const register = { ...openRegister("", ""), file }
  const worlds = new Map<string, World>([[initial[0], { register, cache: register, undo: [] }]])
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
  expect(edges).toBeGreaterThan(20)
}, 600_000)
