import { afterAll, beforeAll, expect, it } from "vitest"

import { postgresInfo } from "./harness.js"
import {
  decide,
  indexedDeck,
  loadDeck,
  loadTurn,
  request,
  settle,
  turnRow,
  wholeCall,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { openPool } from "./pool.js"

let stores: Stores

beforeAll(async () => {
  const info = await postgresInfo()
  stores = { deck: openPool(info.deck, "slide-stop-deck"), session: openPool(info.session, "slide-stop-session") }
})

afterAll(async () => {
  await Promise.all([stores.deck.end(), stores.session.end()])
})

async function slideRun(): Promise<Owned & { readonly base: number }> {
  const owned = await indexedDeck(stores, "slide-stop")
  const added = await wholeCall(owned, "r", "add_slide", {
    deck: owned.deck,
    base: owned.revision,
    after: "256",
    layout: "256",
  })
  if (!added.ok) throw new Error(added.refusal)
  return { ...owned, base: added.deck.revision }
}

it.fails("lands no slide of a run that only added slides once its stop answered", async () => {
  const owned = await slideRun()
  const agent = request(owned, "u")
  await loadTurn(owned, agent)
  await loadDeck(owned, agent)
  const stop = request(owned, "s")
  await loadTurn(owned, stop)
  await loadDeck(owned, stop)
  expect((await decide(owned, stop, "stop_run", { deck: owned.deck, runId: "r" })).ok).toBe(true)
  await settle(stop)
  const added = await decide(owned, agent, "add_slide", { deck: owned.deck, base: owned.base, after: "256", layout: "256" })
  expect(added.ok).toBe(false)
})

it.fails("keeps the turn ended after stop_run answered while an add_slide of the run was saving its turn", async () => {
  const owned = await slideRun()
  const agent = request(owned, "u")
  await loadTurn(owned, agent)
  await loadDeck(owned, agent)
  const added = await decide(owned, agent, "add_slide", { deck: owned.deck, base: owned.base, after: "256", layout: "256" })
  expect(added.ok).toBe(true)
  const stop = request(owned, "s")
  await loadTurn(owned, stop)
  await loadDeck(owned, stop)
  expect((await decide(owned, stop, "stop_run", { deck: owned.deck, runId: "r" })).ok).toBe(true)
  await settle(stop)
  expect((await turnRow(owned))?.run_id).toBe(null)
  await settle(agent)
  expect((await turnRow(owned))?.run_id).toBe(null)
})
