import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { replayCredits } from "./credits-replay.js"
import { postgresInfo } from "./harness.js"
import { openPool } from "../index.js"
import { specGraph, type Graph } from "./spec-graph.js"

let db: ReturnType<typeof openPool>
let graph: Graph
beforeAll(async () => {
  const info = await postgresInfo()
  db = openPool(info.admin, "credits-replay")
  graph = await specGraph("credits", "Credits")
}, 60_000)
afterAll(async () => {
  await db.end()
})

describe("credits model replay", () => {
  it("drives every reset, retry, turn and weekly renewal edge through the database functions", async () => {
    const replayed = await replayCredits(graph, db)
    expect(graph.states.size).toBeGreaterThan(0)
    expect(replayed.edges).toBeGreaterThan(graph.states.size)
    expect(replayed.actions).toEqual(["Finish", "Monday", "Reserve", "ResetA", "ResetB"])
    expect(replayed.failures).toEqual([])
  })
})
