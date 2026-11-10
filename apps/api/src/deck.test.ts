import { randomBytes } from "node:crypto"
import { notifyKey, readDeckId } from "@airdesign/catalog"
import { call, openDeck } from "@airdesign/engine"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, readSaved, writeRevision, type Mail, type Sql } from "./index.js"

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

  it("lands a commit once when the same request is sent twice", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const body = { deck: named.deck, batch: [{ value: "once", node: "a" }], once: "same" }
    const first = await ask(base, "POST", "/decks/commit", body, cookie)
    const second = await ask(base, "POST", "/decks/commit", body, cookie)
    const again = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    expect(first.status).toBe(200)
    expect(second.json).toEqual(first.json)
    expect(again.json).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 1,
        register: expect.objectContaining({
          landed: [expect.objectContaining({ value: "once" })],
        }),
      }),
    )
  })

  it("keeps a once to its own account and deck", async () => {
    const first = readDeckId(deckName())
    const second = readDeckId(deckName())
    const third = readDeckId(deckName())
    if (!first.ok || !second.ok || !third.ok) throw new Error("deck")
    const other = await sign(address("b"))
    await ask(base, "POST", "/decks/open", { deck: first.deck }, cookie)
    await ask(base, "POST", "/decks/open", { deck: second.deck }, cookie)
    await ask(base, "POST", "/decks/open", { deck: third.deck }, other)
    const once = "shared"
    const own = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: first.deck, batch: [{ value: "one", node: "a" }], once },
      cookie,
    )
    const sameAccount = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: second.deck, batch: [{ value: "two", node: "a" }], once },
      cookie,
    )
    const otherAccount = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: third.deck, batch: [{ value: "three", node: "a" }], once },
      other,
    )
    expect(own.json).toEqual({ ok: true, deck: first.deck, revision: 1, key: `${first.deck}:1` })
    expect(sameAccount.json).toEqual({ ok: true, deck: second.deck, revision: 1, key: `${second.deck}:1` })
    expect(otherAccount.json).toEqual({ ok: true, deck: third.deck, revision: 1, key: `${third.deck}:1` })
  })

  it("wakes a watch when a commit with once lands", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const info = await postgresInfo()
    const ear = new Client({ connectionString: info.listen, application_name: "once-watch-ear" })
    await ear.connect()
    const notes: string[] = []
    ear.on("notification", (message) => {
      if (typeof message.payload === "string") notes.push(message.payload)
    })
    await ear.query("listen deck")
    try {
      await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
      let answered = false
      const pending = ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 0 }, cookie).then((response) => {
        answered = true
        return response
      })
      await wait(200)
      await ear.query("select pg_notify('deck', 'probe:0')")
      await wait(200)
      expect(answered).toBe(false)
      const committed = await ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: "once", node: "a" }], once: "wake" },
        cookie,
      )
      const watched = await Promise.race([
        pending,
        wait(2000).then(() => ({ json: { ok: false, refusal: "timeout" } })),
      ])
      const heard = Date.now()
      while (!notes.includes(`${named.deck}:1`) && Date.now() - heard < 1000) await wait(20)
      expect(committed.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: `${named.deck}:1` })
      expect(watched.json).toEqual({ ok: true, deck: named.deck, revision: 1 })
      expect(notes).toContain(`${named.deck}:1`)
    } finally {
      await ear.end()
    }
  }, 15_000)

  it("refuses a stale commit that carries a once", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const info = await postgresInfo()
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const first = call(
      "commit_edits",
      openDeck(named.deck),
      { actor: "person" },
      {
        deck: named.deck,
        batch: [{ value: "one" }],
      },
    )
    if (!first.ok) throw new Error(first.refusal)
    const holder = new Client({ connectionString: info.deck, application_name: "once-holder" })
    const admin = new Client({ connectionString: info.admin, application_name: "once-admin" })
    await holder.connect()
    await admin.connect()
    try {
      await holder.query("begin")
      const held = await writeRevision(holder, {
        id: first.deck.id,
        revision: first.deck.revision,
        register: first.deck.register,
        expected: 0,
        key: first.key,
      })
      expect(held).toBe(true)
      const pending = ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: "two", node: "a" }], once: "stale" },
        cookie,
      )
      const started = Date.now()
      let waiting = false
      while (!waiting) {
        const found = await admin.query(
          "select pid from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock'",
          ["deck-handler"],
        )
        waiting = found.rows.length > 0
        if (!waiting && Date.now() - started > 3000) throw new Error("the commit did not wait")
        if (!waiting) await wait(20)
      }
      await holder.query("commit")
      const landed = await pending
      const saved = await deck.query<{ revision: number; register: { landed: { value: string }[] } }>(
        "select revision, register from deck.saved where id = $1",
        [named.deck],
      )
      expect(landed.json).toEqual({ ok: true, deck: named.deck, revision: 2, key: `${named.deck}:2` })
      expect(saved.rows[0]?.revision).toBe(2)
      expect(saved.rows[0]?.register.landed.map((row) => row.value)).toEqual(["one", "two"])
    } finally {
      await holder.query("rollback").catch(() => undefined)
      await holder.end()
      await admin.end()
    }
  }, 15_000)

  it("keeps the once row with the deck row", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const info = await postgresInfo()
    const reader = openPool(info.deck, "once-reader")
    try {
      await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
      const refused = await ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: "no", node: "b" }], once: "refused" },
        cookie,
      )
      const left = await reader.query<{ count: string }>(
        "select count(*)::text as count from deck.once where deck = $1",
        [named.deck],
      )
      expect(refused.json).toEqual({ ok: false, refusal: "dead" })
      expect(left.rows[0]?.count).toBe("0")
      let stop = false
      let split = false
      const polling = (async () => {
        while (!stop) {
          const seen = await reader.query<{ revision: number; noted: number }>(
            "select saved.revision, (select count(*)::int from deck.once where deck = saved.id and once = $2) as noted from deck.saved saved where saved.id = $1",
            [named.deck, "kept"],
          )
          const row = seen.rows[0]
          if (row !== undefined && row.revision >= 1 && Number(row.noted) === 0) split = true
          await wait(2)
        }
      })()
      const landed = await ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: "yes", node: "a" }], once: "kept" },
        cookie,
      )
      stop = true
      await polling
      expect(split).toBe(false)
      expect(landed.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: `${named.deck}:1` })
    } finally {
      await reader.end()
    }
  }, 15_000)

  it("leaves the deck row when the once row cannot be written", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const info = await postgresInfo()
    const writer = openPool(info.deck, "once-writer")
    try {
      await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
      await writer.query("insert into deck.once (email, deck, once, revision, notify) values ($1, $2, $3, $4, $5)", [
        "taken@example.com",
        named.deck,
        "taken",
        9,
        `${named.deck}:9`,
      ])
      const before = await readSaved(writer, named.deck)
      if (before === undefined) throw new Error("no row")
      await expect(
        writeRevision(writer, {
          id: named.deck,
          revision: 1,
          register: before.register,
          expected: 0,
          key: `${named.deck}:1`,
          once: { email: "taken@example.com", once: "taken" },
        }),
      ).rejects.toMatchObject({ code: "23505" })
      const after = await readSaved(writer, named.deck)
      expect(after?.revision).toBe(0)
    } finally {
      await writer.end()
    }
  })

  it("replays the first revision after later commits moved the deck", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const body = { deck: named.deck, batch: [{ value: "once", node: "a" }], once: "first" }
    const first = await ask(base, "POST", "/decks/commit", body, cookie)
    await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "two" }] }, cookie)
    await ask(base, "POST", "/decks/commit", { deck: named.deck, batch: [{ value: "three" }] }, cookie)
    const again = await ask(base, "POST", "/decks/commit", body, cookie)
    const opened = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    expect(first.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: `${named.deck}:1` })
    expect(again.json).toEqual(first.json)
    expect(opened.json).toEqual(
      expect.objectContaining({
        ok: true,
        revision: 3,
        register: expect.objectContaining({
          landed: [
            expect.objectContaining({ value: "once" }),
            expect.objectContaining({ value: "two" }),
            expect.objectContaining({ value: "three" }),
          ],
        }),
      }),
    )
  })

  it("lets a corrected commit land after a refused one with the same once", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    const refused = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "no", node: "b" }], once: "r" },
      cookie,
    )
    const landed = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "yes", node: "a" }], once: "r" },
      cookie,
    )
    expect(refused.json).toEqual({ ok: false, refusal: "dead" })
    expect(landed.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: `${named.deck}:1` })
  })

  it("refuses another account before it replays a once", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const other = await sign(address("c"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "once", node: "a" }], once: "owned" },
      cookie,
    )
    const refused = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "other", node: "a" }], once: "owned" },
      other,
    )
    expect(refused.json).toEqual({ ok: false, refusal: "owner" })
    expect(Object.hasOwn(refused.json as object, "revision")).toBe(false)
    expect(Object.hasOwn(refused.json as object, "key")).toBe(false)
  })
})
