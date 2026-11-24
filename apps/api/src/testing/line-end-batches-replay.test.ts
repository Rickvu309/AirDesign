import { randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { openPool } from "../index.js"
import { postgresInfo } from "./harness.js"
import { replayLineEndBatches } from "./line-end-batches-replay.js"
import { specGraph, type Graph } from "./spec-graph.js"

let pool: ReturnType<typeof openPool>
let admin = new Client()
let graph: Graph
const email = `batches${randomBytes(4).toString("hex")}@example.com`

beforeAll(async () => {
  const info = await postgresInfo()
  pool = openPool(info.deck, "line-end-batches-replay")
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  await admin.query("insert into session.account (email) values ($1)", [email])
  graph = await specGraph("line-end-batches", "LineEndBatches")
}, 60_000)

afterAll(async () => {
  await Promise.all([pool.end(), admin.end()])
})

it(
  "lands every batch of the line-end-batches model on Postgres, leaving what the model and the whole deck leave",
  { timeout: 120_000 },
  async () => {
    const replayed = await replayLineEndBatches(graph, pool, email)
    expect(graph.states.size).toBeGreaterThan(100)
    expect(replayed.edges).toBeGreaterThan(graph.states.size)
    expect(replayed.failures).toEqual([])
  },
)
