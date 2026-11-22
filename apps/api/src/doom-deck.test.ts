import { randomBytes } from "node:crypto"
import { doomRoutes } from "@airdesign/catalog"
import { orderKeyBetween, doom } from "@airdesign/document"
import { templateTheme } from "@airdesign/templates"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { startIds } from "./doom-start.js"

const mails: Mail[] = []
let base = ""
let admin = new Client()
let owner = { email: "", cookie: "" }
let stranger = { email: "", cookie: "" }
let close = async () => {}

const person: doom.Author = { kind: "person", id: "tab-1" }
const at = (parent: doom.NodeId, after: string | null = null) => ({
  id: parent,
  at: orderKeyBetween(after as never, null),
})

async function account(): Promise<{ email: string; cookie: string }> {
  const email = `doom${randomBytes(4).toString("hex")}@example.com`
  return { email, cookie: await signInByCode(base, mails, email) }
}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "doom-session")
  const deck = openPool(info.deck, "doom-deck")
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

const named = () => `doom${randomBytes(6).toString("hex")}`

type Answer = Record<string, any>

async function post(route: keyof typeof doomRoutes, body: unknown, cookie = owner.cookie) {
  const reply = await ask(base, "POST", doomRoutes[route].path, body, cookie)
  return { status: reply.status, json: reply.json as Answer }
}

async function made(cookie = owner.cookie): Promise<string> {
  const deck = named()
  const created = await post("create", { deck }, cookie)
  expect(created.json.ok).toBe(true)
  return deck
}

async function foldOf(deck: string): Promise<doom.Doom> {
  const opened = await post("open", { deck })
  const folded = doomRoutes.open.result(opened.json)
  if (!folded.ok) throw new Error(JSON.stringify(folded))
  return folded.fold
}

let counter = 0
const edit = (writes: readonly unknown[], once = `o-${randomBytes(4).toString("hex")}-${(counter += 1)}`) => ({
  once,
  author: person,
  writes,
})

const send = (deck: string, writes: readonly unknown[], once?: string, cookie = owner.cookie) =>
  post("edit", { deck, edit: edit(writes, once) }, cookie)

const rename = (name: string) => [{ node: startIds.deck, prop: "name", value: name }]

describe("creating a doom deck", () => {
  it("answers 401 session to a visitor who is not signed in", async () => {
    const reply = await ask(base, "POST", doomRoutes.create.path, { deck: named() })
    expect([reply.status, reply.json]).toEqual([401, { ok: false, refusal: "session" }])
  })

  it("starts the caller's deck from one slide row and one title slide with the Neutral theme", async () => {
    const deck = named()
    const created = await post("create", { deck })
    const decoded = doomRoutes.create.result(created.json)
    if (!decoded.ok) throw new Error(JSON.stringify(decoded))
    expect(decoded.rev).toBe(1)
    const { fold } = decoded
    const types = [...fold.nodes.values()].map((node) => node.type).sort()
    expect(types).toEqual(["deck", "shape", "shape", "slide", "slideRow"])
    const neutral = templateTheme("neutral")!
    const theme = (fold.nodes.get(startIds.deck) as { theme: doom.Theme }).theme
    expect(theme.colors.text).toBe(`#${neutral.colors.dk1.toLowerCase()}`)
    expect(theme.colors.accent1).toBe(`#${neutral.colors.accent1.toLowerCase()}`)
    expect(theme.fonts).toEqual({ heading: neutral.fonts.major, body: neutral.fonts.minor })
    expect(Object.keys(theme.textStyles)).toEqual([
      "bigNumber",
      "title",
      "heading",
      "body",
      "body2",
      "caption",
      "label",
    ])
    expect(fold.children.get(startIds.deck)).toEqual([startIds.row])
    expect(fold.children.get(startIds.row)).toEqual([startIds.slide])
    expect(fold.children.get(startIds.slide)).toEqual([startIds.title, startIds.subtitle])
    const row = await admin.query("select owner, rev from deck.doom where id = $1", [deck])
    expect(row.rows).toEqual([{ owner: owner.email, rev: 1 }])
    const logged = await admin.query("select rev, once from deck.doom_edit where deck = $1", [deck])
    expect(logged.rows).toHaveLength(1)
  })

  it("answers the same deck to the owner who creates it again and refuses anyone else", async () => {
    const deck = await made()
    await send(deck, rename("Kept"))
    const again = await post("create", { deck })
    expect(again.json).toMatchObject({ ok: true, deck, rev: 2 })
    const taken = await post("create", { deck }, stranger.cookie)
    expect(taken.json).toEqual({ ok: false, refusal: "owner" })
    expect(await admin.query("select owner from deck.doom where id = $1", [deck])).toMatchObject({
      rows: [{ owner: owner.email }],
    })
  })
})

describe("opening a doom deck", () => {
  it("hands the owner the stored fold at its revision and nobody else", async () => {
    const deck = await made()
    await send(deck, rename("Opened"))
    const opened = await post("open", { deck })
    expect(opened.json).toMatchObject({ ok: true, deck, rev: 2 })
    expect((await foldOf(deck)).nodes.get(startIds.deck)).toMatchObject({ name: "Opened" })
    expect((await post("open", { deck }, stranger.cookie)).json).toEqual({ ok: false, refusal: "owner" })
    expect((await post("open", { deck: named() })).json).toEqual({ ok: false, refusal: "deck" })
    expect((await post("open", { deck: "bad id" })).json).toEqual({ ok: false, refusal: "deck" })
  })
})

describe("an edit", () => {
  it("lands at the next revision and reads back, in the fold and in the log", async () => {
    const deck = await made()
    const landed = await send(deck, rename("Quarterly"))
    expect(landed.json).toEqual({ ok: true, deck, rev: 2 })
    const fold = await foldOf(deck)
    expect(fold.rev).toBe(2)
    expect(fold.nodes.get(startIds.deck)).toMatchObject({ name: "Quarterly" })
    expect(fold.revs.get(startIds.deck)?.get("name")).toBe(2)
    const caught = await post("since", { deck, rev: 1 })
    expect(caught.json).toMatchObject({ ok: true, deck, rev: 2 })
    expect(caught.json.edits).toHaveLength(1)
    expect(caught.json.edits[0]).toMatchObject({ rev: 2, author: person, writes: rename("Quarterly") })
  })

  it("makes the stored fold what replaying the whole log from nothing gives", async () => {
    const deck = await made()
    const card = doom.nodeId("c1:1")
    await send(deck, [
      { node: card, prop: "type", value: "frame" },
      { node: card, prop: "parent", value: at(startIds.slide) },
      { node: card, prop: "name", value: "Card" },
    ])
    await send(deck, [{ node: card, prop: "name", value: "Renamed" }])
    await send(deck, [{ node: startIds.title, prop: "name", value: "T" }])
    const logged = await post("since", { deck, rev: 0 })
    let replayed: doom.Doom = doom.emptyDoom
    for (const raw of logged.json.edits) {
      const landed = doom.readLanded(raw, replayed)
      if (doom.isRefusal(landed)) throw new Error(JSON.stringify(landed))
      const next = doom.applyEdit(replayed, landed)
      if (doom.isRefusal(next)) throw new Error(JSON.stringify(next))
      replayed = next
    }
    const stored = await foldOf(deck)
    expect(doom.foldToJson(replayed)).toEqual(doom.foldToJson(stored))
  })

  it("answers a repeated once with the revision it landed at and logs nothing twice", async () => {
    const deck = await made()
    const first = await send(deck, rename("Once"), "same-once")
    const second = await send(deck, rename("Once"), "same-once")
    expect(first.json).toEqual({ ok: true, deck, rev: 2 })
    expect(second.json).toEqual(first.json)
    const other = await send(deck, rename("Other"), "next-once")
    expect(other.json).toMatchObject({ rev: 3 })
    expect((await admin.query("select count(*)::int as n from deck.doom_edit where deck = $1", [deck])).rows).toEqual([
      { n: 3 },
    ])
  })

  it("lands two edits sent at the same moment one after the other with distinct revisions", async () => {
    const deck = await made()
    const answers = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        send(deck, [{ node: startIds.slide, prop: "name", value: `Slide ${String(index)}` }]),
      ),
    )
    expect(answers.map((answer) => answer.json.ok)).toEqual(Array(6).fill(true))
    expect(answers.map((answer) => answer.json.rev).sort()).toEqual([2, 3, 4, 5, 6, 7])
    expect((await foldOf(deck)).rev).toBe(7)
  })

  it("refuses a text write whose base is behind with stale, and changes nothing", async () => {
    const deck = await made()
    const words = (chars: string) => ({
      chars,
      spans: [],
      paras: [{}],
      style: "title",
      resize: "height",
      alignV: "top",
    })
    const first = await send(deck, [{ node: startIds.title, prop: "text", value: words("Mine"), base: 1 }])
    expect(first.json).toMatchObject({ ok: true, rev: 2 })
    const before = await foldOf(deck)
    const stale = await send(deck, [{ node: startIds.title, prop: "text", value: words("Late"), base: 1 }])
    expect(stale.json).toEqual({ ok: false, refusal: "edit", refused: "stale", node: startIds.title, prop: "text" })
    const unbased = await send(deck, [{ node: startIds.title, prop: "text", value: words("None") }])
    expect(unbased.json).toMatchObject({ ok: false, refusal: "edit", refused: "stale" })
    const after = await foldOf(deck)
    expect(doom.foldToJson(after)).toEqual(doom.foldToJson(before))
    expect((await post("since", { deck, rev: 0 })).json.edits).toHaveLength(2)
  })

  it("refuses a move into the node's own subtree with cycle", async () => {
    const deck = await made()
    const outer = doom.nodeId("c1:1")
    const inner = doom.nodeId("c1:2")
    await send(deck, [
      { node: outer, prop: "type", value: "frame" },
      { node: outer, prop: "parent", value: at(startIds.slide) },
      { node: inner, prop: "type", value: "frame" },
      { node: inner, prop: "parent", value: at(outer) },
    ])
    const cycle = await send(deck, [{ node: outer, prop: "parent", value: at(inner) }])
    expect(cycle.json).toEqual({ ok: false, refusal: "edit", refused: "cycle", node: outer, prop: "parent" })
  })

  it("refuses an edit that takes the deck past the slide limit with limit, whole", async () => {
    const deck = await made()
    const writes = Array.from({ length: 50 }, (_, index) => {
      const slide = doom.nodeId(`c1:${String(index + 1)}`)
      return [
        { node: slide, prop: "type", value: "slide" },
        { node: slide, prop: "parent", value: at(startIds.row) },
      ]
    }).flat()
    const over = await send(deck, writes)
    expect(over.json).toMatchObject({ ok: false, refusal: "edit", refused: "limit" })
    expect((await foldOf(deck)).rev).toBe(1)
    const fits = await send(deck, writes.slice(0, 98))
    expect(fits.json).toMatchObject({ ok: true, rev: 2 })
  })

  it("keeps the stored live counts equal to a recount through adds, hides, moves and deletes", async () => {
    const deck = await made()
    const row = doom.nodeId("w:1")
    const slides = [doom.nodeId("w:2"), doom.nodeId("w:3"), doom.nodeId("w:4")]
    const shape = doom.nodeId("w:5")
    const stored = async () =>
      (await admin.query("select elements, slides from deck.doom where id = $1", [deck])).rows[0] as {
        elements: number
        slides: number
      }
    const recount = async () => doom.countsOf(await foldOf(deck))
    const lands = async (writes: readonly unknown[]) => expect((await send(deck, writes)).json.ok).toBe(true)
    await lands([
      { node: row, prop: "type", value: "slideRow" },
      { node: row, prop: "parent", value: at(startIds.deck, "a0") },
      ...slides.flatMap((slide) => [
        { node: slide, prop: "type", value: "slide" },
        { node: slide, prop: "parent", value: at(row) },
      ]),
      { node: shape, prop: "type", value: "shape" },
      { node: shape, prop: "parent", value: at(slides[0]!) },
    ])
    expect(await stored()).toEqual(await recount())
    expect(await stored()).toEqual({ elements: 9, slides: 4 })
    await lands([{ node: row, prop: "hidden", value: true }])
    expect(await stored()).toEqual({ elements: 9, slides: 1 })
    await lands([{ node: slides[1]!, prop: "parent", value: at(startIds.row) }])
    expect(await stored()).toEqual(await recount())
    expect(await stored()).toEqual({ elements: 9, slides: 2 })
    await lands([{ node: row, prop: "hidden", value: false }])
    expect(await stored()).toEqual({ elements: 9, slides: 4 })
    await lands([{ node: slides[2]!, prop: "parent", value: null }])
    expect(await stored()).toEqual(await recount())
    await lands([{ node: row, prop: "parent", value: null }])
    expect(await stored()).toEqual(await recount())
    expect(await stored()).toEqual({ elements: 7, slides: 2 })
  })

  it("refuses a write the reader cannot read with shape, a node it does not know with missing", async () => {
    const deck = await made()
    expect((await send(deck, [{ node: startIds.deck, prop: "name", value: 7 }])).json).toMatchObject({
      refusal: "edit",
      refused: "shape",
    })
    expect((await send(deck, [{ node: "c1:9", prop: "name", value: "x" }])).json).toMatchObject({
      refusal: "edit",
      refused: "missing",
    })
    expect(
      (await post("edit", { deck, edit: { once: "o", author: person, writes: [], extra: 1 } })).json,
    ).toMatchObject({
      refusal: "edit",
      refused: "shape",
    })
    expect((await foldOf(deck)).rev).toBe(1)
  })

  it("is the owner's alone", async () => {
    const deck = await made()
    expect((await send(deck, rename("Mine"), undefined, stranger.cookie)).json).toEqual({
      ok: false,
      refusal: "owner",
    })
    expect((await send(named(), rename("None"))).json).toEqual({ ok: false, refusal: "deck" })
    expect((await foldOf(deck)).rev).toBe(1)
  })

  it("refuses a body that is not an edit for a deck before it reads the store", async () => {
    const deck = await made()
    expect((await post("edit", { deck })).json).toEqual({ ok: false, refusal: "field" })
    expect((await post("edit", { deck, edit: [] })).json).toEqual({ ok: false, refusal: "field" })
  })
})

describe("catching up from a revision", () => {
  it("answers the edits after the cursor in order, and nothing at the head", async () => {
    const deck = await made()
    await send(deck, rename("A"))
    await send(deck, rename("B"))
    await send(deck, rename("C"))
    const since = await post("since", { deck, rev: 1 })
    expect(since.json.edits.map((landed: { rev: number }) => landed.rev)).toEqual([2, 3, 4])
    expect(since.json.rev).toBe(4)
    const head = await post("since", { deck, rev: 4 })
    expect(head.json).toMatchObject({ ok: true, rev: 4, edits: [] })
  })

  it("refuses a cursor past the head, a deck that is not the caller's, and a deck that is not there", async () => {
    const deck = await made()
    expect((await post("since", { deck, rev: 9 })).json).toEqual({ ok: false, refusal: "cursor" })
    expect((await post("since", { deck, rev: 0 }, stranger.cookie)).json).toEqual({ ok: false, refusal: "owner" })
    expect((await post("since", { deck: named(), rev: 0 })).json).toEqual({ ok: false, refusal: "deck" })
  })

  it("holds a waiting catch-up until an edit lands, then answers it", async () => {
    const deck = await made()
    const waiting = post("since", { deck, rev: 1, wait: true })
    await new Promise((resolve) => setTimeout(resolve, 150))
    await send(deck, rename("Woken"))
    const woken = await waiting
    expect(woken.json).toMatchObject({ ok: true, rev: 2 })
    expect(woken.json.edits).toHaveLength(1)
  })

  it("answers a waiting catch-up at once when the head is already past the cursor", async () => {
    const deck = await made()
    await send(deck, rename("Ahead"))
    const caught = await post("since", { deck, rev: 1, wait: true })
    expect(caught.json).toMatchObject({ ok: true, rev: 2 })
  })

  it("leaves a second tab's cursor where it was until it asks", async () => {
    const deck = await made()
    const first = await foldOf(deck)
    await send(deck, rename("Moved"))
    expect(first.rev).toBe(1)
    const caught = await post("since", { deck, rev: first.rev })
    let view = first
    for (const raw of caught.json.edits) {
      const landed = doom.readLanded(raw, view)
      if (doom.isRefusal(landed)) throw new Error("read")
      const next = doom.applyEdit(view, landed)
      if (doom.isRefusal(next)) throw new Error("apply")
      view = next
    }
    expect(doom.foldToJson(view)).toEqual(doom.foldToJson(await foldOf(deck)))
  })
})

describe("deleting the account", () => {
  it("takes the account's doom decks and their edits with it", async () => {
    const gone = await account()
    const deck = await made(gone.cookie)
    await send(deck, rename("Gone"), undefined, gone.cookie)
    const kept = await made()
    const before = await admin.query("select count(*)::int as n from deck.doom_edit where deck = $1", [deck])
    expect(before.rows).toEqual([{ n: 2 }])
    const deleted = await ask(base, "POST", "/account/delete", { email: gone.email }, gone.cookie)
    expect(deleted.status).toBe(200)
    expect((await admin.query("select id from deck.doom where id = $1", [deck])).rows).toEqual([])
    expect((await admin.query("select rev from deck.doom_edit where deck = $1", [deck])).rows).toEqual([])
    expect((await admin.query("select id from deck.doom where id = $1", [kept])).rows).toEqual([{ id: kept }])
  })
})
