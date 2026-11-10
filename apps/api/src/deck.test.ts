import { randomBytes } from "node:crypto"
import { notifyKey, readDeckId } from "@airdesign/catalog"
import { openDeck } from "@airdesign/engine"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

function deckName(): string {
  return `deck${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

describe("deck routes", () => {
  const mails: Mail[] = []
  let base = ""
  let cookie = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "deck-session")
    deck = openPool(info.deck, "deck-handler")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      session,
      deck,
      listen,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
    const email = `person${randomBytes(4).toString("hex")}@example.com`
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[0]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email, code })
    const sessionCookie = cookieFrom(signed.headers)
    if (sessionCookie === undefined) throw new Error("cookie")
    cookie = sessionCookie
    close = async () => {
      await served.close()
      await listen.close()
      await session.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function sign(email: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email })
    const code = mails[index]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email, code })
    const sessionCookie = cookieFrom(signed.headers)
    if (sessionCookie === undefined) throw new Error("cookie")
    return sessionCookie
  }

  it("refuses a deck route without a session", async () => {
    for (const path of ["/decks/open", "/decks/commit", "/decks/watch"]) {
      const response = await ask(base, "POST", path, { deck: "abc", cursor: null, batch: [{ value: "hi" }] })
      expect(response.status).toBe(401)
      expect(response.json).toEqual({ ok: false, refusal: "session" })
    }
  })

  it("stores one empty row on the first open and reads it again", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const opened = openDeck(named.deck)
    const first = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const second = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    expect(first.status).toBe(200)
    expect(first.json).toEqual({ ok: true, deck: named.deck, revision: 0, register: opened.register })
    expect(second.json).toEqual(first.json)
    const counted = await deck.query<{ count: string }>(
      "select count(*)::text as count from deck.saved where id = $1",
      [named.deck],
    )
    expect(counted.rows[0]?.count).toBe("1")
  })

  it("commits as the person and returns the notify key", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const response = await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "hi" }] }, cookie)
    const key = notifyKey(named.deck, 1)
    expect(response.status).toBe(200)
    expect(key.ok).toBe(true)
    if (!key.ok) return
    expect(response.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: key.key })
  })

  it("keeps the stored row when the commit is refused", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const opened = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const refused = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "hi" }, { value: "no", node: "b" }] },
      cookie,
    )
    const actor = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, actor: "person", batch: [{ value: "hi" }] },
      cookie,
    )
    const again = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    expect(refused.status).toBe(200)
    expect(refused.json).toEqual({ ok: false, refusal: "dead" })
    expect(actor.json).toEqual({ ok: false, refusal: "field" })
    expect(again.json).toEqual(opened.json)
  })

  it("does not create a row when open or watch cannot be parsed", async () => {
    const id = deckName()
    const before = await deck.query<{ count: string }>("select count(*)::text as count from deck.saved where id = $1", [
      id,
    ])
    const badDeck = await ask(base, "POST", "/decks/open", { deck: "bad id" }, cookie)
    const badField = await ask(base, "POST", "/decks/open", {}, cookie)
    const watchField = await ask(base, "POST", "/decks/watch", { deck: id }, cookie)
    const watchCursor = await ask(base, "POST", "/decks/watch", { deck: id, cursor: -1 }, cookie)
    const watchDeck = await ask(base, "POST", "/decks/watch", { deck: "bad id", cursor: 0 }, cookie)
    const after = await deck.query<{ count: string }>("select count(*)::text as count from deck.saved where id = $1", [
      id,
    ])
    expect(badDeck.json).toEqual({ ok: false, refusal: "deck" })
    expect(badField.json).toEqual({ ok: false, refusal: "field" })
    expect(watchField.json).toEqual({ ok: false, refusal: "field" })
    expect(watchCursor.json).toEqual({ ok: false, refusal: "cursor" })
    expect(watchDeck.json).toEqual({ ok: false, refusal: "deck" })
    expect(before.rows[0]?.count).toBe("0")
    expect(after.rows[0]?.count).toBe("0")
  })

  it("returns the current revision for a null cursor and the next revision after that", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const head = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: null }, cookie)
    expect(head.json).toEqual({ ok: true, deck: named.deck, revision: 0 })
    expect(Object.keys(head.json as object).sort()).toEqual(["deck", "ok", "revision"])
    await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "one" }] }, cookie)
    await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "two" }] }, cookie)
    await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "three" }] }, cookie)
    const first = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 0 }, cookie)
    const second = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 1 }, cookie)
    const current = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: null }, cookie)
    expect(first.json).toEqual({ ok: true, deck: named.deck, revision: 1 })
    expect(second.json).toEqual({ ok: true, deck: named.deck, revision: 2 })
    expect(current.json).toEqual({ ok: true, deck: named.deck, revision: 3 })
  })

  it("refuses another account on a deck it did not open", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const first = address("a")
    const second = address("b")
    const account = await sign(first)
    const other = await sign(second)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, account)
    const committed = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "of A" }] },
      account,
    )
    expect(committed.status).toBe(200)
    const kept = await deck.query<{ revision: number; owner: string; register: { landed: { value: string }[] } }>(
      "select revision, owner, register from deck.saved where id = $1",
      [named.deck],
    )
    expect(kept.rows[0]?.owner).toBe(first)
    expect(kept.rows[0]?.revision).toBe(1)
    expect(kept.rows[0]?.register.landed.map((row) => row.value)).toEqual(["of A"])
    const seen = await ask(base, "POST", "/decks/open", { deck: named.deck }, other)
    const refused = await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "of B" }] }, other)
    const watched = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: null }, other)
    const after = await deck.query<{ revision: number; owner: string; register: { landed: { value: string }[] } }>(
      "select revision, owner, register from deck.saved where id = $1",
      [named.deck],
    )
    expect(seen.status).toBe(200)
    expect(seen.json).toEqual({ ok: false, refusal: "owner" })
    expect(seen.text.includes("of A")).toBe(false)
    expect(refused.status).toBe(200)
    expect(refused.json).toEqual({ ok: false, refusal: "owner" })
    expect(watched.status).toBe(200)
    expect(watched.json).toEqual({ ok: false, refusal: "owner" })
    expect(after.rows).toEqual(kept.rows)
  })

  it("holds until a stored revision is greater than the cursor", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const pending = ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 0 }, cookie)
    const committed = await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "hi" }] }, cookie)
    const watched = await pending
    expect(committed.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: `${named.deck}:1` })
    expect(watched.json).toEqual({ ok: true, deck: named.deck, revision: 1 })
  })
})
