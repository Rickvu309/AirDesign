import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { replayCredits } from "./credits-replay.js"
import { postgresInfo } from "./harness.js"
import { openPool } from "./index.js"
import { specGraph } from "./spec-graph.js"

let db: ReturnType<typeof openPool>
beforeAll(async () => {
  const info = await postgresInfo()
  db = openPool(info.admin, "credits-replay")
})
afterAll(async () => {
  await db.end()
})

describe("credits model replay", () => {
  it("drives every reset, retry, turn and weekly renewal edge through the database functions", async () => {
    const graph = await specGraph("credits", "Credits")
    const replayed = await replayCredits(graph, db)
    expect(graph.states.size).toBeGreaterThan(0)
    expect(replayed.edges).toBeGreaterThan(graph.states.size)
    expect(replayed.actions).toEqual(["Finish", "Monday", "Reserve", "ResetA", "ResetB"])
    expect(replayed.failures).toEqual([])
  })
})
