import { createServer } from "node:http"

import { liveRuns } from "@airdesign/engine"
import { afterAll, beforeAll, expect, it } from "vitest"

import {
  finish,
  indexedDeck,
  mcpSteps,
  revisionOf,
  slidesAddedBy,
  stepNode as node,
  wholeCall,
  type McpSteps,
  type Owned,
  type Stores,
} from "./mcp-steps.js"
import { postgresInfo } from "./harness.js"
import { openPool } from "./pool.js"
import { readSaved, spendOnce } from "./saved.js"

let stores: Stores
let steps: McpSteps

beforeAll(async () => {
  const info = await postgresInfo()
  stores = { deck: openPool(info.deck, "agent-once-deck"), session: openPool(info.session, "agent-once-session") }
  steps = await mcpSteps(createServer)
})

afterAll(async () => {
  await steps.close()
  await Promise.all([stores.deck.end(), stores.session.end()])
})

async function stored(owned: Owned) {
  const saved = await readSaved(stores.deck, owned.deck)
  if (saved === undefined || saved.register === null) throw new Error("deck")
  return saved
}

function addSlide(owned: Owned & { readonly revision: number }) {
  return { deck: owned.deck, base: owned.revision, after: "256", layout: "256" }
}

function editTitle(owned: Owned & { readonly revision: number }) {
  return { deck: owned.deck, base: owned.revision, changes: [{ node, value: "Agent", readAt: 0 }] }
}

it("lands an add_slide sent twice with one once a single time, and answers the second with the first's slide", async () => {
  const owned = await indexedDeck(stores, "agent-once")
  const first = await wholeCall(steps, owned, "r", "add_slide", addSlide(owned), "add-1")
  expect(first.body).toMatchObject({ ok: true, runId: "r", revision: owned.revision + 1 })
  const again = await wholeCall(steps, owned, "u", "add_slide", addSlide(owned), "add-1")
  expect(again).toEqual(first)
  const saved = await stored(owned)
  expect(saved.revision).toBe(owned.revision + 1)
  expect(slidesAddedBy(saved.register, "r")).toEqual([first.body?.slide])
})

it("lands an add_slide once when its second send lands while the first waits at its deck write", async () => {
  const owned = await indexedDeck(stores, "agent-once")
  const first = await steps.start(owned, "r", "add_slide", addSlide(owned), "add-1")
  while (first.at !== "write") await first.release()
  const again = await wholeCall(steps, owned, "r", "add_slide", addSlide(owned), "add-1")
  expect(again.body).toMatchObject({ ok: true, runId: "r", revision: owned.revision + 1 })
  expect(await finish(first)).toEqual(again)
  const saved = await stored(owned)
  expect(saved.revision).toBe(owned.revision + 1)
  expect(slidesAddedBy(saved.register, "r")).toHaveLength(1)
})

it("adds two slides for two add_slide calls with different onces at one base", async () => {
  const owned = await indexedDeck(stores, "agent-once")
  const first = await wholeCall(steps, owned, "r", "add_slide", addSlide(owned), "add-1")
  const second = await wholeCall(steps, owned, "u", "add_slide", addSlide(owned), "add-2")
  expect(revisionOf(second)).toBe(revisionOf(first) + 1)
  expect(slidesAddedBy((await stored(owned)).register, "r")).toHaveLength(2)
})

for (const gate of ["deck", "write"] as const) {
  it(`keeps an edit from landing once a Stop spent its once while it waited at its ${gate === "deck" ? "deck read" : "deck write"}`, async () => {
    const owned = await indexedDeck(stores, "agent-once")
    const edit = await steps.start(owned, "r", "edit_deck", editTitle(owned), "edit-1")
    while (edit.at !== gate) await edit.release()
    expect(await spendOnce(stores.deck, owned.email, owned.deck, "edit-1")).toEqual({ ok: true })
    const refused = await finish(edit)
    expect(refused.body).toMatchObject({ ok: false, refusal: "run-fenced", revision: owned.revision })
    const saved = await stored(owned)
    expect(saved.revision).toBe(owned.revision)
    expect(liveRuns({ id: owned.deck, revision: saved.revision, register: saved.register })).toEqual([])
    const again = await wholeCall(steps, owned, "u", "edit_deck", editTitle(owned), "edit-1")
    expect(again.body).toMatchObject({ ok: false, refusal: "run-fenced" })
  })
}

it("answers a Stop that spends a landed call's once with the run it landed", async () => {
  const owned = await indexedDeck(stores, "agent-once")
  const landed = await wholeCall(steps, owned, "r", "edit_deck", editTitle(owned), "edit-1")
  expect(landed.body).toMatchObject({ ok: true, runId: "r" })
  expect(await spendOnce(stores.deck, owned.email, owned.deck, "edit-1")).toEqual({ ok: true, runId: "r" })
  expect(await spendOnce(stores.deck, owned.email, owned.deck, "edit-1")).toEqual({ ok: true, runId: "r" })
})

it("spends no once on a deck the account does not own", async () => {
  const owned = await indexedDeck(stores, "agent-once")
  const other = await indexedDeck(stores, "agent-once")
  expect(await spendOnce(stores.deck, other.email, owned.deck, "edit-1")).toEqual({ ok: false })
  const landed = await wholeCall(steps, owned, "r", "edit_deck", editTitle(owned), "edit-1")
  expect(landed.body).toMatchObject({ ok: true, runId: "r" })
})
