import { randomBytes } from "node:crypto"
import { doomRoutes, readDeckId, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { beforeAll, describe, expect, it } from "vitest"

import { editDoom } from "./doom/doom-deck.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { heldQueries } from "./testing/held-queries.js"

let base = ""
let owner = { email: "", cookie: "" }
let stranger = ""
let decks: ReturnType<typeof openPool>
const person: doom.Author = { kind: "person", id: "tab" }
const rename = (value: string): doom.Write[] => [{ node: startIds.deck, prop: "name", value }]
const edit = (writes: readonly doom.Write[]) => ({ once: crypto.randomUUID(), author: person, writes })

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "read-base-session")
  decks = openPool(info.deck, "read-base-deck")
  const listen = new DeckListen(info.listen)
  const mails: Mail[] = []
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
  const email = "owner@example.com"
  owner = { email, cookie: await signInByCode(base, mails, email) }
  stranger = await signInByCode(base, mails, "stranger@example.com")
  return async () => {
    await served.close()
    await listen.close()
    await Promise.all([session.end(), decks.end()])
  }
})

const post = (route: keyof typeof doomRoutes, body: unknown, cookie = owner.cookie) =>
  ask(base, "POST", doomRoutes[route].path, body, cookie)

async function made(): Promise<DeckId> {
  const id = readDeckId(`guard${randomBytes(6).toString("hex")}`)
  if (!id.ok) throw new Error("invalid deck id")
  expect((await post("create", { deck: id.deck })).json).toMatchObject({ ok: true })
  return id.deck
}

async function foldOf(deck: DeckId): Promise<doom.Doom> {
  const opened = doomRoutes.open.result((await post("open", { deck })).json)
  if (!opened.ok) throw new Error(JSON.stringify(opened))
  return opened.fold
}

async function logOf(deck: DeckId) {
  const log = doomRoutes.since.result((await post("since", { deck, rev: 1 })).json)
  if (!log.ok) throw new Error(JSON.stringify(log))
  return log
}

const send = (deck: DeckId, writes: readonly doom.Write[]) => post("edit", { deck, edit: edit(writes) })

describe("an edit with a read base", () => {
  it("checks the base of an empty edit without writing a row", async () => {
    const deck = await made()
    const command = { ...edit([]), readBase: 1 }
    expect((await post("edit", { deck, edit: command })).json).toEqual({ ok: true, deck, rev: 1 })
    expect((await logOf(deck)).edits).toEqual([])
    expect((await send(deck, rename("Later"))).json).toEqual({ ok: true, deck, rev: 2 })
    expect((await post("edit", { deck, edit: command })).json).toEqual({
      ok: false,
      refusal: "edit",
      refused: "stale",
    })
  })

  it("lands at the exact head and returns the same answer after the reply is lost", async () => {
    const deck = await made()
    const command = { ...edit(rename("Prepared")), readBase: 1 }
    const first = await post("edit", { deck, edit: command })
    expect(first.json).toEqual({ ok: true, deck, rev: 2 })
    expect((await send(deck, rename("Later"))).json).toEqual({ ok: true, deck, rev: 3 })
    expect((await post("edit", { deck, edit: command }, stranger)).json).toEqual({
      ok: false,
      refusal: "owner",
    })
    expect((await post("edit", { deck, edit: command })).json).toEqual(first.json)
    expect(doom.deckName(await foldOf(deck))).toBe("Later")
    expect((await logOf(deck)).edits).toMatchObject([{ once: command.once, readBase: 1, rev: 2 }, { rev: 3 }])
  })

  it("refuses the whole edit if a different writer beats the compare-and-swap", async () => {
    const deck = await made()
    const before = await foldOf(deck)
    const held = heldQueries(decks)
    const write = held.hold("with updated as")
    const prepared = editDoom(
      held.db,
      { deck, edit: { ...edit(rename("Prepared")), readBase: before.rev } },
      owner.email,
    )
    const awaitingWrite = await Promise.race([write.reached.then(() => true), prepared.then(() => false)])
    expect(awaitingWrite).toBe(true)
    try {
      expect((await send(deck, [{ node: startIds.slide, prop: "name", value: "Other" }])).json).toEqual({
        ok: true,
        deck,
        rev: 2,
      })
    } finally {
      write.release()
    }
    expect(await prepared).toEqual({ ok: false, refusal: "edit", refused: "stale" })
    const after = await foldOf(deck)
    expect(after.rev).toBe(2)
    expect(doom.deckName(after)).toBe(doom.deckName(before))
    expect(after.nodes.get(startIds.slide)).toMatchObject({ name: "Other" })
    expect((await logOf(deck)).edits).toHaveLength(1)
  })

  it("lands consecutive prepared bases in order and refuses a future or invalid base", async () => {
    const deck = await made()
    const first = { ...edit(rename("First")), readBase: 1 }
    const second = { ...edit(rename("Second")), readBase: 2 }
    expect((await post("edit", { deck, edit: second })).json).toEqual({ ok: false, refusal: "edit", refused: "stale" })
    expect((await post("edit", { deck, edit: { ...second, readBase: null } })).json).toEqual({
      ok: false,
      refusal: "edit",
      refused: "shape",
    })
    const landed = await post("edit", { deck, edit: first })
    expect(landed.json).toEqual({ ok: true, deck, rev: 2 })
    expect((await post("edit", { deck, edit: second })).json).toEqual({ ok: true, deck, rev: 3 })
    expect(doom.deckName(await foldOf(deck))).toBe("Second")
  })
})

it("refuses legacy component writes from a tab that still has them queued", async () => {
  const deck = await made()
  const component = doom.nodeId("component:1")
  for (const write of [
    { node: component, prop: "type", value: "component" },
    { node: component, prop: "instance", value: null },
  ] satisfies readonly doom.Write[]) {
    expect((await send(deck, [...rename("Legacy"), write])).json).toMatchObject({
      ok: false,
      refusal: "edit",
      refused: "shape",
      node: component,
      prop: write.prop,
    })
  }
  expect((await logOf(deck)).edits).toEqual([])
})
