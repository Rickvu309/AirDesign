import { randomBytes } from "node:crypto"
import { sceneRoutes } from "@airdesign/catalog"
import { orderKeyBetween, scene } from "@airdesign/document"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { startIds } from "./scene-start.js"

const mails: Mail[] = []
let base = ""
let admin = new Client()
let owner = { email: "", cookie: "" }
let stranger = ""
let close = async () => {}

const agent = (run: string): scene.Author => ({ kind: "agent", id: "aira", run })
const person: scene.Author = { kind: "person", id: "tab-1" }
const at = (parent: scene.NodeId) => ({ id: parent, at: orderKeyBetween(null, null) })
const made = scene.nodeId("r:1")
const box = (x: number) => ({ x, y: 0, w: 100, h: 50, rotation: 0, flipH: false, flipV: false })

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "scene-run-session")
  const deck = openPool(info.deck, "scene-run-deck")
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
  await post(sceneRoutes.create.path, { deck })
  const send = async (edit: Record<string, unknown>) =>
    expect((await post(sceneRoutes.edit.path, { deck, edit })).ok).toBe(true)
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

describe("a run's edits and the nodes as they were before it", () => {
  it("answers the run's edits in order, each at its revision, and each touched node's first earlier state", async () => {
    const deck = await deckWithRun()
    const answer = await post(sceneRoutes.run.path, { deck, run: "run-1" })
    expect(answer.ok).toBe(true)
    expect(answer.edits.map((edit: { once: string; rev: number }) => [edit.once, edit.rev])).toEqual([
      ["a1", 3],
      ["a2", 4],
    ])
    expect(Object.keys(answer.before)).toEqual([startIds.title])
    expect(answer.before[startIds.title].box.x).toBe(5)
    expect(sceneRoutes.run.result(answer)).toMatchObject({ ok: true })
  })

  it("answers nothing for a run that never landed an edit", async () => {
    const deck = await deckWithRun()
    expect(await post(sceneRoutes.run.path, { deck, run: "nobody" })).toMatchObject({ ok: true, edits: [], before: {} })
  })

  it("is the owner's alone, and refuses a deck that is not there", async () => {
    const deck = await deckWithRun()
    expect(await post(sceneRoutes.run.path, { deck, run: "run-1" }, stranger)).toEqual({ ok: false, refusal: "owner" })
    expect(await post(sceneRoutes.run.path, { deck: "nothere", run: "run-1" })).toEqual({ ok: false, refusal: "deck" })
  })

  it("keeps the earlier state of a node only for an agent's edit", async () => {
    const deck = await deckWithRun()
    const rows = await admin.query(
      "select once, was is not null as kept from deck.scene_edit where deck = $1 order by rev",
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
