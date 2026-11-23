import { randomBytes } from "node:crypto"
import { blankDeckName, doomRoutes } from "@airdesign/catalog"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Row = { deck: string; name: string; edited: string; created: string; trashed?: string; starred?: boolean }
type Listed = {
  ok: boolean
  decks: (Row & { doom?: { rev: number } })[]
  trash: (Row & { doom?: { rev: number } })[]
}

const mails: Mail[] = []
let base = ""
let admin = new Client()
let owner = ""
let stranger = ""
let close = async () => {}

const named = () => `doom${randomBytes(6).toString("hex")}`

async function account(): Promise<string> {
  return signInByCode(base, mails, `list${randomBytes(4).toString("hex")}@example.com`)
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "doom-list-session")
  const deck = openPool(info.deck, "doom-list-deck")
  const listen = new DeckListen(info.listen)
  admin = new Client({ connectionString: info.admin })
  await admin.connect()
  const served = await serve({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  owner = await account()
  stranger = await account()
  close = async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), deck.end(), admin.end()])
  }
})

afterAll(async () => {
  await close()
})

async function made(cookie = owner): Promise<string> {
  const deck = named()
  const created = await ask(base, "POST", doomRoutes.create.path, { deck }, cookie)
  expect(created.json).toMatchObject({ ok: true })
  return deck
}

const post = async (path: string, body: object, cookie = owner) => (await ask(base, "POST", path, body, cookie)).json

const list = async (cookie = owner) => (await post("/decks/list", {}, cookie)) as Listed

const found = async (deck: string, cookie = owner) => {
  const listed = await list(cookie)
  return { live: listed.decks.find((row) => row.deck === deck), trash: listed.trash.find((row) => row.deck === deck) }
}

describe("a doom deck in the deck list", () => {
  it("is listed with its name, its times and a mark that it is a doom deck", async () => {
    const deck = await made()
    const { live } = await found(deck)
    expect(live).toMatchObject({ deck, name: blankDeckName, doom: { rev: 1 }, starred: false })
    expect(new Date(live?.created ?? "").toISOString()).toBe(live?.created)
    expect(new Date(live?.edited ?? "").toISOString()).toBe(live?.edited)
  })

  it("is not listed for another account", async () => {
    const deck = await made()
    expect((await list(stranger)).decks.map((row) => row.deck)).not.toContain(deck)
  })

  it("sits above an older deck, newest edited first", async () => {
    const old = await made()
    const fresh = await made()
    const order = (await list()).decks.map((row) => row.deck)
    expect(order.indexOf(fresh)).toBeLessThan(order.indexOf(old))
  })

  it("moves its edited time forward when an edit lands", async () => {
    const deck = await made()
    const before = (await found(deck)).live?.edited ?? ""
    await new Promise((resolve) => setTimeout(resolve, 20))
    const edit = {
      once: "e1",
      author: { kind: "person", id: "t" },
      writes: [{ node: "s:1", prop: "name", value: "Q4" }],
    }
    await post(doomRoutes.edit.path, { deck, edit })
    const after = (await found(deck)).live
    expect(after?.name).toBe("Q4")
    expect(after?.doom).toEqual({ rev: 2 })
    expect(Date.parse(after?.edited ?? "")).toBeGreaterThan(Date.parse(before))
  })
})

describe("renaming, starring, trashing and deleting a doom deck", () => {
  it("renames it through the deck name, so the stored deck and the list agree", async () => {
    const deck = await made()
    expect(await post("/decks/rename", { deck, name: "Board update" })).toEqual({
      ok: true,
      deck,
      name: "Board update",
    })
    expect((await found(deck)).live?.name).toBe("Board update")
    const opened = doomRoutes.open.result(await post(doomRoutes.open.path, { deck }))
    if (!opened.ok) throw new Error("open")
    expect(opened.fold.nodes.get("s:1" as never)).toMatchObject({ name: "Board update" })
  })

  it("refuses a rename by someone else", async () => {
    const deck = await made()
    expect(await post("/decks/rename", { deck, name: "Mine" }, stranger)).toEqual({ ok: false, refusal: "owner" })
    expect((await found(deck)).live?.name).toBe(blankDeckName)
  })

  it("refuses a name Postgres cannot store and keeps the old name", async () => {
    const deck = await made()
    await post("/decks/rename", { deck, name: "kept" })
    for (const name of ["a\u0000b", "\ud800", "a\udc00b"])
      expect(await post("/decks/rename", { deck, name })).toEqual({ ok: false, refusal: "field" })
    expect((await found(deck)).live?.name).toBe("kept")
  })

  it("stars and unstars it", async () => {
    const deck = await made()
    expect(await post("/decks/star", { deck, starred: true })).toEqual({ ok: true, deck, starred: true })
    expect((await found(deck)).live?.starred).toBe(true)
    await post("/decks/star", { deck, starred: false })
    expect((await found(deck)).live?.starred).toBe(false)
  })

  it("moves it to the trash and restores it", async () => {
    const deck = await made()
    const trashed = (await post("/decks/trash", { deck })) as { ok: boolean; trashed: string }
    expect(trashed.ok).toBe(true)
    const inTrash = await found(deck)
    expect(inTrash.live).toBeUndefined()
    expect(inTrash.trash).toMatchObject({ deck, doom: { rev: expect.any(Number) }, trashed: trashed.trashed })
    expect(await post("/decks/restore", { deck })).toEqual({ ok: true, deck })
    const back = await found(deck)
    expect(back.trash).toBeUndefined()
    expect(back.live).toMatchObject({ deck, doom: { rev: expect.any(Number) } })
  })

  it("keeps the first trashed time when trashed twice", async () => {
    const deck = await made()
    const first = (await post("/decks/trash", { deck })) as { trashed: string }
    const second = (await post("/decks/trash", { deck })) as { trashed: string }
    expect(first.trashed).toEqual(expect.any(String))
    expect(second.trashed).toBe(first.trashed)
  })

  it("refuses trash and restore by someone else", async () => {
    const deck = await made()
    expect(await post("/decks/trash", { deck }, stranger)).toEqual({ ok: false, refusal: "owner" })
    await post("/decks/trash", { deck })
    expect(await post("/decks/restore", { deck }, stranger)).toEqual({ ok: false, refusal: "owner" })
  })

  it("deletes only a trashed deck, for good, with its edits", async () => {
    const live = await made()
    const gone = await made()
    await post("/decks/trash", { deck: gone })
    expect(await post("/decks/delete", { decks: [live, gone] })).toEqual({ ok: true, deleted: [gone] })
    const listed = await list()
    expect(listed.decks.map((row) => row.deck)).toContain(live)
    expect([...listed.decks, ...listed.trash].map((row) => row.deck)).not.toContain(gone)
    const edits = await admin.query("select count(*)::int as count from deck.doom_edit where deck = $1", [gone])
    expect(edits.rows[0]?.count).toBe(0)
    expect((await post(doomRoutes.open.path, { deck: gone })) as object).toEqual({ ok: false, refusal: "deck" })
  })

  it("queues the pictures of a deleted deck for removal and drops their rows, also after thirty days", async () => {
    for (const how of ["delete", "expire"]) {
      const deck = await made()
      const key = `${owner}/${deck}/picture`
      await admin.query("insert into deck.media (key, deck, sha256, bytes) values ($1, $2, 'abc', 3)", [key, deck])
      await post("/decks/trash", { deck })
      if (how === "delete") await post("/decks/delete", { decks: [deck] })
      else {
        await admin.query("update deck.doom set trashed = now() - interval '31 days' where id = $1", [deck])
        await list()
      }
      expect((await admin.query("select 1 from deck.media where deck = $1", [deck])).rows).toEqual([])
      expect((await admin.query("select 1 from deck.original_delete where key = $1", [key])).rows).toHaveLength(1)
    }
  })

  it("does not delete a trashed deck of someone else", async () => {
    const deck = await made()
    await post("/decks/trash", { deck })
    expect(await post("/decks/delete", { decks: [deck] }, stranger)).toEqual({ ok: true, deleted: [] })
    expect((await found(deck)).trash).toBeDefined()
  })

  it("is removed after thirty days in the trash and kept at twenty-nine", async () => {
    const deck = await made()
    const recent = await made()
    await post("/decks/trash", { deck })
    await post("/decks/trash", { deck: recent })
    await admin.query("update deck.doom set trashed = now() - interval '31 days' where id = $1", [deck])
    await admin.query("update deck.doom set trashed = now() - interval '29 days' where id = $1", [recent])
    const listed = await list()
    expect([...listed.decks, ...listed.trash].map((row) => row.deck)).not.toContain(deck)
    expect(listed.trash.map((row) => row.deck)).toContain(recent)
  })

  it("is kept past thirty days in the trash when another account reads its list", async () => {
    const deck = await made(stranger)
    await post("/decks/trash", { deck }, stranger)
    await admin.query("update deck.doom set trashed = now() - interval '40 days' where id = $1", [deck])
    await list()
    expect((await admin.query("select 1 from deck.doom where id = $1", [deck])).rows).toHaveLength(1)
  })

  it("answers only the ids it deleted, skipping a missing one", async () => {
    const deck = await made()
    await post("/decks/trash", { deck })
    expect(await post("/decks/delete", { decks: [named(), deck] })).toEqual({ ok: true, deleted: [deck] })
  })

  it("refuses every deck list route without a session", async () => {
    for (const path of [
      "/decks/list",
      "/decks/rename",
      "/decks/star",
      "/decks/trash",
      "/decks/restore",
      "/decks/delete",
    ]) {
      const response = await ask(base, "POST", path, { deck: "abc", name: "x", starred: true, decks: ["abc"] })
      expect(response.status).toBe(401)
      expect(response.json).toEqual({ ok: false, refusal: "session" })
    }
  })
})
