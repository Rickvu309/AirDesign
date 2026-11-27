import { randomBytes } from "node:crypto"
import { doomRoutes, readDeckId } from "@airdesign/catalog"
import type { Run } from "@airdesign/doom/testing"
import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { heldQueries } from "./testing/held-queries.js"
import { editDoom } from "./doom/doom-deck.js"
import { endIdleRuns, runIdle } from "./doom/idle-runs.js"
import { startIds } from "./doom/doom-start.js"

const mails: Mail[] = []
let base = ""
let owner = { email: "", cookie: "" }
let admin = new Client()
let decks = openPool("postgres://deck@127.0.0.1/api")
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "idle-session")
  decks = openPool(info.deck, "idle-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    session,
    deck: decks,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  const email = `idle${randomBytes(4).toString("hex")}@example.com`
  owner = { email, cookie: await signInByCode(base, mails, email) }
  close = async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), decks.end(), admin.end()])
  }
})

afterAll(async () => {
  await close()
})

async function madeDeck() {
  const id = `idle${randomBytes(6).toString("hex")}`
  expect((await ask(base, "POST", doomRoutes.create.path, { deck: id }, owner.cookie)).json).toMatchObject({ ok: true })
  const read = readDeckId(id)
  if (!read.ok) throw new Error(id)
  return read.deck
}

const started = (run: string, agent: string) => ({
  once: `${run}-start`,
  author: { kind: "agent", id: agent, run, name: agent },
  writes: [{ node: startIds.deck, prop: "name", value: run }],
  phase: "start",
})

async function runsOf(deck: string): Promise<ReadonlyMap<string, Run>> {
  const opened = await ask(base, "POST", doomRoutes.open.path, { deck }, owner.cookie)
  const folded = doomRoutes.open.result(opened.json)
  if (!folded.ok) throw new Error(JSON.stringify(folded))
  return folded.fold.runs
}

it("stops a run whose last write landed before the cutoff, as its own agent, and leaves a newer run running", async () => {
  const deck = await madeDeck()
  expect(await editDoom(decks, { deck, edit: started("quiet", "claude") }, owner.email)).toMatchObject({ ok: true })
  await admin.query("update deck.doom_edit set landed = now() - interval '11 minutes' where deck = $1", [deck])
  expect(await editDoom(decks, { deck, edit: started("busy", "codex") }, owner.email)).toMatchObject({ ok: true })
  await endIdleRuns(decks, new Date(Date.now() - runIdle))
  const runs = await runsOf(deck)
  expect(runs.get("quiet")).toMatchObject({ phase: "stopped", agent: "claude" })
  expect(runs.get("busy")).toMatchObject({ phase: "running" })
  const stop = await admin.query<{ edit: { author: unknown; phase: string } }>(
    "select edit from deck.doom_edit where deck = $1 order by rev desc limit 1",
    [deck],
  )
  expect(stop.rows[0]?.edit).toMatchObject({ author: { kind: "agent", id: "claude", run: "quiet" }, phase: "stop" })
  await endIdleRuns(decks, new Date(Date.now() - runIdle))
  expect((await runsOf(deck)).get("busy")).toMatchObject({ phase: "running" })
})

it("keeps a run open through five quiet minutes, so the agent's next write continues the same run", async () => {
  const deck = await madeDeck()
  expect(await editDoom(decks, { deck, edit: started("thinking", "claude") }, owner.email)).toMatchObject({ ok: true })
  await admin.query("update deck.doom_edit set landed = now() - interval '5 minutes' where deck = $1", [deck])
  await endIdleRuns(decks, new Date(Date.now() - runIdle))
  expect((await runsOf(deck)).get("thinking")).toMatchObject({ phase: "running" })
  const later = await editDoom(
    decks,
    {
      deck,
      edit: {
        once: "thinking-late",
        author: { kind: "agent", id: "claude", run: "thinking" },
        writes: [{ node: startIds.deck, prop: "name", value: "Later" }],
      },
    },
    owner.email,
  )
  expect(later).toMatchObject({ ok: true })
  expect((await runsOf(deck)).get("thinking")).toMatchObject({ phase: "running", wrote: later.ok ? later.rev : -1 })
})

it("leaves a run open when its agent writes after the sweep chose it and before the stop lands", async () => {
  const deck = await madeDeck()
  expect(await editDoom(decks, { deck, edit: started("racing", "claude") }, owner.email)).toMatchObject({ ok: true })
  await admin.query("update deck.doom_edit set landed = now() - interval '11 minutes' where deck = $1", [deck])
  const held = heldQueries(decks)
  const stop = held.hold("with updated as")
  const sweep = endIdleRuns(held.db, new Date(Date.now() - runIdle))
  await stop.reached
  const write = await editDoom(
    decks,
    {
      deck,
      edit: {
        once: "racing-late",
        author: { kind: "agent", id: "claude", run: "racing" },
        writes: [{ node: startIds.deck, prop: "name", value: "Just in time" }],
      },
    },
    owner.email,
  )
  expect(write).toMatchObject({ ok: true })
  stop.release()
  await sweep
  expect((await runsOf(deck)).get("racing")).toMatchObject({ phase: "running" })
})
