import { randomBytes } from "node:crypto"
import { doomRoutes } from "@airdesign/catalog"
import { orderKeyBetween } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { startIds } from "./doom/doom-start.js"

const mails: Mail[] = []
let base = ""
let admin = new Client()
let owner = { email: "", cookie: "" }
let stranger = ""
let close = async () => {}

const agent = (run: string): doom.Author => ({ kind: "agent", id: "aira", run })
const person: doom.Author = { kind: "person", id: "tab-1" }
const at = (parent: doom.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const made = doom.nodeId("r:1")
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "doom-run-session")
  const deck = openPool(info.deck, "doom-run-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => void mails.push(mail),
  })
  base = served.base
  const sign = async () => {
    const email = `run${randomBytes(4).toString("hex")}@example.com`
    return { email, cookie: await signInByCode(base, mails, email) }
  }
  owner = await sign()
  stranger = (await sign()).cookie
  close = async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), deck.end(), admin.end()])
  }
})

afterAll(async () => {
  await close()
})

const post = async (path: string, body: unknown, cookie = owner.cookie) =>
  (await ask(base, "POST", path, body, cookie)).json as Record<string, any>

async function deckWithRun() {
  const deck = `run${randomBytes(6).toString("hex")}`
  await post(doomRoutes.create.path, { deck })
  const send = async (edit: Record<string, unknown>) =>
    expect((await post(doomRoutes.edit.path, { deck, edit })).ok).toBe(true)
  await send({ once: "p1", author: person, writes: [{ node: startIds.title, prop: "box", value: box(5) }] })
  await send({
    once: "a1",
    author: agent("run-1"),
    phase: "start",
    writes: [{ node: startIds.title, prop: "box", value: box(10) }],
  })
  await send({
    once: "a2",
    author: agent("run-1"),
    writes: [
      { node: startIds.title, prop: "box", value: box(20) },
      { node: made, prop: "type", value: "shape" },
      { node: made, prop: "parent", value: at(startIds.slide) },
    ],
  })
  await send({ once: "other", author: agent("run-2"), phase: "start", writes: [] })
  return deck
}

describe("a run's edits and the values each one replaced", () => {
  it("answers the run's edits in order, each at its revision, with the value and revision each write replaced", async () => {
    const deck = await deckWithRun()
    const answer = await post(doomRoutes.run.path, { deck, run: "run-1" })
    expect(answer.ok).toBe(true)
    expect(answer.edits.map((edit: { once: string; rev: number }) => [edit.once, edit.rev])).toEqual([
      ["a1", 3],
      ["a2", 4],
    ])
    expect(answer.replaced).toEqual([
      [{ node: startIds.title, key: "box", value: box(5), rev: 2 }],
      [
        { node: startIds.title, key: "box", value: box(10), rev: 3 },
        { node: made, key: "parent", value: null, rev: null },
      ],
    ])
    expect(doomRoutes.run.result(answer)).toMatchObject({ ok: true })
  })

  it("answers nothing for a run that never landed an edit", async () => {
    const deck = await deckWithRun()
    expect(await post(doomRoutes.run.path, { deck, run: "nobody" })).toMatchObject({
      ok: true,
      edits: [],
      replaced: [],
    })
  })

  it("is the owner's alone, and refuses a deck that is not there", async () => {
    const deck = await deckWithRun()
    expect(await post(doomRoutes.run.path, { deck, run: "run-1" }, stranger)).toEqual({ ok: false, refusal: "owner" })
    expect(await post(doomRoutes.run.path, { deck: "nothere", run: "run-1" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("keeps the replaced values only for an agent's edit", async () => {
    const deck = await deckWithRun()
    const rows = await admin.query(
      "select once, replaced is not null as kept from deck.doom_edit where deck = $1 order by rev",
      [deck],
    )
    expect(rows.rows).toEqual([
      { once: expect.any(String), kept: false },
      { once: "p1", kept: false },
      { once: "a1", kept: true },
      { once: "a2", kept: true },
      { once: "other", kept: true },
    ])
  })
})
