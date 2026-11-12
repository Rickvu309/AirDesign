import { createServer } from "node:http"

import { afterAll, beforeAll, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import {
  finish,
  indexedDeck,
  mcpSteps,
  revisionOf,
  turnRow,
  wholeCall,
  type McpSteps,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { openPool } from "./pool.js"

let stores: Stores
let steps: McpSteps

beforeAll(async () => {
  const info = await postgresInfo()
  stores = { deck: openPool(info.deck, "slide-stop-deck"), session: openPool(info.session, "slide-stop-session") }
  steps = await mcpSteps(createServer)
})

afterAll(async () => {
  await steps.close()
  await Promise.all([stores.deck.end(), stores.session.end()])
})

async function slideRun(): Promise<Owned & { readonly base: number }> {
  const owned = await indexedDeck(stores, "slide-stop")
  const added = await wholeCall(steps, owned, "r", "add_slide", {
    deck: owned.deck,
    base: owned.revision,
    after: "256",
    layout: "256",
  })
  return { ...owned, base: revisionOf(added) }
}

async function addingSlide(owned: Owned & { readonly base: number }) {
  const agent = await steps.start(owned, "u", "add_slide", {
    deck: owned.deck,
    base: owned.base,
    after: "256",
    layout: "256",
  })
  await agent.release()
  await agent.release()
  expect(agent.at).toBe("write")
  return agent
}

it.fails("lands no slide of a run that only added slides once its stop answered", async () => {
  const owned = await slideRun()
  const agent = await addingSlide(owned)
  const stopped = await wholeCall(steps, owned, "s", "stop_run", { deck: owned.deck, runId: "r" })
  expect(stopped.ok).toBe(true)
  expect((await finish(agent)).ok).toBe(false)
})

it.fails("keeps the turn ended after stop_run answered while an add_slide of the run was saving its turn", async () => {
  const owned = await slideRun()
  const agent = await addingSlide(owned)
  await agent.release()
  expect(agent.at).toBe("save")
  const stopped = await wholeCall(steps, owned, "s", "stop_run", { deck: owned.deck, runId: "r" })
  expect(stopped.ok).toBe(true)
  expect((await turnRow(owned))?.run_id).toBe(null)
  await finish(agent)
  expect((await turnRow(owned))?.run_id).toBe(null)
})
