import { randomBytes } from "node:crypto"
import { doomRoutes } from "@airdesign/catalog"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { heldQueries, type HeldQueries } from "./testing/held-queries.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { sinceDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"

const mails: Mail[] = []
let base = ""
let admin = new Client()
let owner = { email: "", cookie: "" }
let decks = openPool("postgres://deck@127.0.0.1/api")
let counted: HeldQueries = heldQueries(decks)
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "since-session")
  await decks.end()
  decks = openPool(info.deck, "since-deck")
  counted = heldQueries(decks)
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    session,
    deck: counted.db,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  const email = `since${randomBytes(4).toString("hex")}@example.com`
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

type Answer = Record<string, any>

const post = async (route: keyof typeof doomRoutes, body: unknown) =>
  (await ask(base, "POST", doomRoutes[route].path, body, owner.cookie)).json as Answer

let counter = 0
async function made(): Promise<string> {
  const deck = `since${randomBytes(6).toString("hex")}`
  expect((await post("create", { deck })).ok).toBe(true)
  return deck
}

async function rename(deck: string, name: string) {
  const edit = {
    once: `s-${(counter += 1)}`,
    author: { kind: "person", id: "tab" },
    writes: [{ node: startIds.deck, prop: "name", value: name }],
  }
  expect((await post("edit", { deck, edit })).ok).toBe(true)
}

describe("catching up from a revision under load", () => {
  it("reads the deck and its edits in one query", async () => {
    const deck = await made()
    await rename(deck, "Counted")
    const one = heldQueries(decks)
    const caught = await sinceDoom(one.db, { deck: deck as never, rev: 1 }, owner.email)
    expect(caught).toMatchObject({ ok: true, rev: 2, edits: [{ rev: 2 }] })
    expect(one.times("")).toBe(1)
  })

  it("answers a catch-up while two slow reads hold deck connections", async () => {
    const deck = await made()
    const lock = Number.parseInt(randomBytes(4).toString("hex"), 16)
    await admin.query("select pg_advisory_lock($1)", [lock])
    const slow = [1, 2].map(() => decks.query("select pg_advisory_xact_lock_shared($1)", [lock]))
    try {
      const waiting = async () =>
        (
          await admin.query<{ n: number }>("select count(*)::int as n from pg_locks where objid = $1 and not granted", [
            lock,
          ])
        ).rows[0]?.n
      await expect.poll(waiting).toBe(2)
      expect(await sinceDoom(decks, { deck: deck as never, rev: 1 }, owner.email)).toMatchObject({ ok: true, rev: 1 })
    } finally {
      await admin.query("select pg_advisory_unlock($1)", [lock])
      await Promise.all(slow)
    }
  })

  it("wakes a held catch-up only for an edit on its own deck, however many decks are held", async () => {
    const held = 40
    const names = await Promise.all(Array.from({ length: held }, () => made()))
    const before = counted.times("rev > $2")
    const reads = () => counted.times("rev > $2") - before
    const waiting = names.map((deck) => post("since", { deck, rev: 1, wait: true }))
    await expect.poll(reads).toBe(held)
    for (const deck of names) await rename(deck, `Woken ${deck}`)
    const woken = await Promise.all(waiting)
    expect(woken.map((answer) => answer.edits.length)).toEqual(names.map(() => 1))
    expect(reads()).toBe(2 * held)
  })
})
