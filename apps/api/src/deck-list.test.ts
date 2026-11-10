import { randomBytes } from "node:crypto"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Row = { deck: string; name: string; edited: string; created: string; trashed?: string }
type Listed = { ok: boolean; account: { email: string }; decks: Row[]; trash: Row[] }

function deckName(): string {
  return `deck${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

function millis(time: string | undefined): number {
  return Date.parse(time ?? "")
}

describe("deck list and trash", () => {
  const mails: Mail[] = []
  let base = ""
  let cookie = ""
  let email = ""
  let admin = new Client()
  let close = async () => {}

  async function sign(account: string): Promise<string> {
    const index = mails.length
    await ask(base, "POST", "/sign-in/email", { email: account })
    const code = mails[index]?.text.split("\n")[1]
    const signed = await ask(base, "POST", "/sign-in/code", { email: account, code })
    const sessionCookie = cookieFrom(signed.headers)
    if (sessionCookie === undefined) throw new Error("cookie")
    return sessionCookie
  }

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "list-session")
    const deck = openPool(info.deck, "list-deck")
    const listen = new DeckListen(info.listen)
    admin = new Client({ connectionString: info.admin, application_name: "list-admin" })
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
    email = address("owner")
    cookie = await sign(email)
    close = async () => {
      await served.close()
      await listen.close()
      await session.end()
      await deck.end()
      await admin.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function open(deck: string, as = cookie): Promise<void> {
    await ask(base, "POST", "/decks/open", { deck }, as)
  }

  async function list(as = cookie): Promise<Listed> {
    const response = await ask(base, "POST", "/decks/list", {}, as)
    return response.json as Listed
  }

  async function row(deck: string): Promise<Record<string, unknown> | undefined> {
    const found = await admin.query("select * from deck.saved where id = $1", [deck])
    return found.rows[0] as Record<string, unknown> | undefined
  }

  async function onceCount(deck: string): Promise<number> {
    const found = await admin.query("select count(*)::int as count from deck.once where deck = $1", [deck])
    return found.rows[0]?.count as number
  }

  async function waiters(count: number): Promise<void> {
    const started = Date.now()
    for (;;) {
      const found = await admin.query(
        "select count(*)::int as count from pg_stat_activity where application_name = $1 and wait_event_type = 'Lock'",
        ["list-deck"],
      )
      if ((found.rows[0]?.count as number) >= count) return
      if (Date.now() - started > 5000) throw new Error("the statements did not wait")
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }

  it("refuses every deck list route without a session", async () => {
    for (const path of ["/decks/list", "/decks/rename", "/decks/trash", "/decks/restore", "/decks/delete"]) {
      const response = await ask(base, "POST", path, { deck: "abc", name: "x", decks: ["abc"] })
      expect(response.status).toBe(401)
      expect(response.json).toEqual({ ok: false, refusal: "session" })
    }
  })

  it("lists only the decks of the signed-in account with its address", async () => {
    const mine = deckName()
    const theirs = deckName()
    const other = address("other")
    const otherCookie = await sign(other)
    await open(mine)
    await open(theirs, otherCookie)
    const response = await ask(base, "POST", "/decks/list", {}, cookie)
    const listed = response.json as Listed
    expect(response.status).toBe(200)
    expect(listed.account).toEqual({ email })
    expect(listed.decks.map((entry) => entry.deck)).toContain(mine)
    expect(listed.decks.map((entry) => entry.deck)).not.toContain(theirs)
    const others = await list(otherCookie)
    expect(others.account).toEqual({ email: other })
    expect(others.decks.map((entry) => entry.deck)).toEqual([theirs])
  })

  it("lists a new deck with an empty name and its edited time at its created time", async () => {
    const named = deckName()
    await open(named)
    const entry = (await list()).decks.find((one) => one.deck === named)
    expect(entry?.name).toBe("")
    expect(entry?.edited).toBe(entry?.created)
    expect(new Date(entry?.created ?? "").toISOString()).toBe(entry?.created)
    expect(Object.keys(entry ?? {}).sort()).toEqual(["created", "deck", "edited", "name"])
  })

  it("lists a deck newest edited first", async () => {
    const first = deckName()
    const second = deckName()
    const third = deckName()
    const own = await sign(address("order"))
    for (const id of [first, second, third]) await open(id, own)
    expect((await list(own)).decks.map((entry) => entry.deck)).toEqual([third, second, first])
    await ask(base, "POST", "/decks/commit", { deck: first, batch: [{ value: "hi", node: "258.7" }] }, own)
    const after = await list(own)
    expect(after.decks.map((entry) => entry.deck)).toEqual([first, third, second])
    expect(millis(after.decks[0]?.edited)).toBeGreaterThan(millis(after.decks[0]?.created))
  })

  it("keeps the created time when a commit lands and moves the edited time", async () => {
    const named = deckName()
    await open(named)
    const before = (await list()).decks.find((one) => one.deck === named)
    await ask(base, "POST", "/decks/commit", { deck: named, batch: [{ value: "hi", node: "258.7" }] }, cookie)
    const after = (await list()).decks.find((one) => one.deck === named)
    expect(after?.created).toBe(before?.created)
    expect(millis(after?.edited)).toBeGreaterThan(millis(before?.edited))
  })

  it("keeps the edited time when a commit repeats its once key", async () => {
    const named = deckName()
    await open(named)
    const batch = [{ value: "hi", node: "258.7" }]
    await ask(base, "POST", "/decks/commit", { deck: named, batch, once: "same" }, cookie)
    const landed = (await list()).decks.find((one) => one.deck === named)
    const again = await ask(base, "POST", "/decks/commit", { deck: named, batch, once: "same" }, cookie)
    expect(again.json).toMatchObject({ ok: true, revision: 1 })
    expect((await list()).decks.find((one) => one.deck === named)?.edited).toBe(landed?.edited)
  })

  it("keeps the edited time and the revision when a deck is renamed", async () => {
    const named = deckName()
    await open(named)
    await ask(base, "POST", "/decks/commit", { deck: named, batch: [{ value: "hi", node: "258.7" }] }, cookie)
    const before = await row(named)
    const response = await ask(base, "POST", "/decks/rename", { deck: named, name: "  Quarterly review  " }, cookie)
    const after = await row(named)
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ ok: true, deck: named, name: "Quarterly review" })
    expect(after?.edited).toEqual(before?.edited)
    expect(after?.revision).toBe(before?.revision)
    expect(after?.name).toBe("Quarterly review")
    expect((await list()).decks.find((one) => one.deck === named)?.name).toBe("Quarterly review")
  })

  it("refuses a name that is blank or longer than 200 characters", async () => {
    const named = deckName()
    await open(named)
    for (const name of ["", "   ", "x".repeat(201), 7, null, "a\u0000b"]) {
      const response = await ask(base, "POST", "/decks/rename", { deck: named, name }, cookie)
      expect(response.json).toEqual({ ok: false, refusal: "field" })
    }
    expect((await row(named))?.name).toBe("")
    const longest = await ask(base, "POST", "/decks/rename", { deck: named, name: ` ${"x".repeat(200)} ` }, cookie)
    expect(longest.json).toEqual({ ok: true, deck: named, name: "x".repeat(200) })
  })

  it("counts a name in characters, not bytes", async () => {
    const named = deckName()
    await open(named)
    const name = "é".repeat(200)
    const response = await ask(base, "POST", "/decks/rename", { deck: named, name }, cookie)
    expect(response.json).toEqual({ ok: true, deck: named, name })
  })

  it("moves a deck to Trash and restores it", async () => {
    const named = deckName()
    await open(named)
    const trashed = await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    expect(trashed.status).toBe(200)
    const body = trashed.json as { ok: boolean; deck: string; trashed: string }
    expect(body).toEqual({ ok: true, deck: named, trashed: expect.any(String) })
    const inTrash = await list()
    expect(inTrash.decks.map((entry) => entry.deck)).not.toContain(named)
    expect(inTrash.trash.find((entry) => entry.deck === named)?.trashed).toBe(body.trashed)
    const restored = await ask(base, "POST", "/decks/restore", { deck: named }, cookie)
    expect(restored.json).toEqual({ ok: true, deck: named })
    const back = await list()
    expect(back.trash.map((entry) => entry.deck)).not.toContain(named)
    expect(back.decks.map((entry) => entry.deck)).toContain(named)
    expect((await row(named))?.trashed).toBeNull()
  })

  it("lists a Trash row with the same fields and the trashed time", async () => {
    const named = deckName()
    await open(named)
    await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    const entry = (await list()).trash.find((one) => one.deck === named)
    expect(Object.keys(entry ?? {}).sort()).toEqual(["created", "deck", "edited", "name", "trashed"])
  })

  it("keeps the first trashed time of a deck already in Trash", async () => {
    const named = deckName()
    await open(named)
    const first = await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    await admin.query("update deck.saved set trashed = trashed - interval '5 days' where id = $1", [named])
    const second = await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    const firstTime = (first.json as { trashed: string }).trashed
    const secondTime = (second.json as { trashed: string }).trashed
    expect(millis(secondTime)).toBe(millis(firstTime) - 5 * 86_400_000)
    expect((await list()).trash.find((one) => one.deck === named)?.trashed).toBe(secondTime)
  })

  it("answers ok when it restores a deck that is not in Trash", async () => {
    const named = deckName()
    await open(named)
    const restored = await ask(base, "POST", "/decks/restore", { deck: named }, cookie)
    expect(restored.status).toBe(200)
    expect(restored.json).toEqual({ ok: true, deck: named })
    expect((await list()).decks.map((entry) => entry.deck)).toContain(named)
  })

  it("opens, commits and watches a deck in Trash as before", async () => {
    const named = deckName()
    await open(named)
    await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    const opened = await ask(base, "POST", "/decks/open", { deck: named }, cookie)
    expect(opened.json).toMatchObject({ ok: true, deck: named, revision: 0 })
    const committed = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named, batch: [{ value: "hi", node: "258.7" }] },
      cookie,
    )
    expect(committed.json).toEqual({ ok: true, deck: named, revision: 1, key: `${named}:1` })
    const watched = await ask(base, "POST", "/decks/watch", { deck: named, cursor: null }, cookie)
    expect(watched.json).toEqual({ ok: true, deck: named, revision: 1 })
    expect((await list()).trash.map((entry) => entry.deck)).toContain(named)
  })

  it("deletes a deck in Trash for good and starts the id empty", async () => {
    const named = deckName()
    await open(named)
    const batch = [{ value: "first", node: "258.7" }]
    await ask(base, "POST", "/decks/commit", { deck: named, batch, once: "keep" }, cookie)
    await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    const deleted = await ask(base, "POST", "/decks/delete", { decks: [named] }, cookie)
    expect(deleted.status).toBe(200)
    expect(deleted.json).toEqual({ ok: true, deleted: [named] })
    expect(await row(named)).toBeUndefined()
    expect(await onceCount(named)).toBe(0)
    const reopened = await ask(base, "POST", "/decks/open", { deck: named }, cookie)
    expect(reopened.json).toMatchObject({ ok: true, deck: named, revision: 0 })
    const replay = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named, batch: [{ value: "second", node: "258.7" }], once: "keep" },
      cookie,
    )
    expect(replay.json).toEqual({ ok: true, deck: named, revision: 1, key: `${named}:1` })
    const read = await ask(base, "POST", "/decks/open", { deck: named }, cookie)
    const register = (read.json as { register: { elements: Record<string, { landed: { value: string }[] }> } }).register
    expect(register.elements["258.7"]?.landed.map((one) => one.value)).toEqual(["second"])
  })

  it("keeps a deck that is not in Trash when it is asked to delete it", async () => {
    const live = deckName()
    const binned = deckName()
    await open(live)
    await open(binned)
    await ask(base, "POST", "/decks/trash", { deck: binned }, cookie)
    const deleted = await ask(base, "POST", "/decks/delete", { decks: [live, binned] }, cookie)
    expect(deleted.json).toEqual({ ok: true, deleted: [binned] })
    expect(await row(live)).toBeDefined()
    expect(await row(binned)).toBeUndefined()
  })

  it("answers only the ids it deleted and skips another account's deck and a missing one", async () => {
    const mine = deckName()
    const theirs = deckName()
    const missing = deckName()
    const otherCookie = await sign(address("skip"))
    await open(mine)
    await open(theirs, otherCookie)
    await ask(base, "POST", "/decks/trash", { deck: mine }, cookie)
    await ask(base, "POST", "/decks/trash", { deck: theirs }, otherCookie)
    const deleted = await ask(base, "POST", "/decks/delete", { decks: [theirs, missing, mine] }, cookie)
    expect(deleted.json).toEqual({ ok: true, deleted: [mine] })
    expect(await row(theirs)).toBeDefined()
    expect((await list(otherCookie)).trash.map((entry) => entry.deck)).toEqual([theirs])
  })

  it("refuses a delete of no ids, more than 100 ids or a bad id", async () => {
    const many = Array.from({ length: 101 }, () => deckName())
    const exact = Array.from({ length: 100 }, () => deckName())
    expect((await ask(base, "POST", "/decks/delete", { decks: [] }, cookie)).json).toEqual({
      ok: false,
      refusal: "field",
    })
    expect((await ask(base, "POST", "/decks/delete", { decks: many }, cookie)).json).toEqual({
      ok: false,
      refusal: "field",
    })
    expect((await ask(base, "POST", "/decks/delete", { decks: exact }, cookie)).json).toEqual({
      ok: true,
      deleted: [],
    })
    expect((await ask(base, "POST", "/decks/delete", { decks: ["bad id"] }, cookie)).json).toEqual({
      ok: false,
      refusal: "deck",
    })
    expect((await ask(base, "POST", "/decks/delete", { decks: "abc" }, cookie)).json).toEqual({
      ok: false,
      refusal: "field",
    })
  })

  it("drops a deck from Trash after 30 days and keeps one at 29 days", async () => {
    const old = deckName()
    const recent = deckName()
    await open(old)
    await open(recent)
    const batch = [{ value: "hi", node: "258.7" }]
    await ask(base, "POST", "/decks/commit", { deck: old, batch, once: "gone" }, cookie)
    await ask(base, "POST", "/decks/trash", { deck: old }, cookie)
    await ask(base, "POST", "/decks/trash", { deck: recent }, cookie)
    await admin.query("update deck.saved set trashed = now() - interval '31 days' where id = $1", [old])
    await admin.query("update deck.saved set trashed = now() - interval '29 days' where id = $1", [recent])
    const listed = await list()
    expect(listed.trash.map((entry) => entry.deck)).toContain(recent)
    expect(listed.trash.map((entry) => entry.deck)).not.toContain(old)
    expect(await row(old)).toBeUndefined()
    expect(await onceCount(old)).toBe(0)
  })

  it("drops only the signed-in account's old Trash when the list is read", async () => {
    const theirs = deckName()
    const otherCookie = await sign(address("age"))
    await open(theirs, otherCookie)
    await ask(base, "POST", "/decks/trash", { deck: theirs }, otherCookie)
    await admin.query("update deck.saved set trashed = now() - interval '40 days' where id = $1", [theirs])
    await list()
    expect(await row(theirs)).toBeDefined()
    expect((await list(otherCookie)).trash).toEqual([])
  })

  it("refuses another account's deck the same way as a missing one", async () => {
    const theirs = deckName()
    const missing = deckName()
    const otherCookie = await sign(address("owner2"))
    await open(theirs, otherCookie)
    const bodies: [string, (deck: string) => unknown][] = [
      ["/decks/rename", (deck) => ({ deck, name: "taken" })],
      ["/decks/trash", (deck) => ({ deck })],
      ["/decks/restore", (deck) => ({ deck })],
    ]
    for (const [path, body] of bodies) {
      const other = await ask(base, "POST", path, body(theirs), cookie)
      const none = await ask(base, "POST", path, body(missing), cookie)
      expect(other.status).toBe(200)
      expect(other.json).toEqual({ ok: false, refusal: "owner" })
      expect(none.json).toEqual(other.json)
    }
    const stored = await row(theirs)
    expect(stored?.name).toBe("")
    expect(stored?.trashed).toBeNull()
    expect(await row(missing)).toBeUndefined()
  })

  it("refuses a body of the wrong shape and a bad deck id", async () => {
    const checks: [string, unknown, string][] = [
      ["/decks/list", { extra: 1 }, "field"],
      ["/decks/list", [], "field"],
      ["/decks/rename", { deck: "abc" }, "field"],
      ["/decks/rename", { deck: "abc", name: "x", more: 1 }, "field"],
      ["/decks/rename", { deck: "bad id", name: "x" }, "deck"],
      ["/decks/trash", {}, "field"],
      ["/decks/trash", { deck: "bad id" }, "deck"],
      ["/decks/trash", { deck: "abc", extra: 1 }, "field"],
      ["/decks/restore", { deck: 5 }, "deck"],
      ["/decks/delete", {}, "field"],
      ["/decks/delete", { decks: ["abc"], extra: 1 }, "field"],
    ]
    for (const [path, body, refusal] of checks) {
      const response = await ask(base, "POST", path, body, cookie)
      expect(response.status).toBe(200)
      expect(response.json).toEqual({ ok: false, refusal })
    }
  })

  it("lists a Trash deck newest edited first", async () => {
    const older = deckName()
    const newer = deckName()
    const own = await sign(address("trashorder"))
    await open(older, own)
    await open(newer, own)
    await ask(base, "POST", "/decks/trash", { deck: older }, own)
    await ask(base, "POST", "/decks/trash", { deck: newer }, own)
    expect((await list(own)).trash.map((entry) => entry.deck)).toEqual([newer, older])
    await ask(base, "POST", "/decks/commit", { deck: older, batch: [{ value: "hi", node: "258.7" }] }, own)
    expect((await list(own)).trash.map((entry) => entry.deck)).toEqual([older, newer])
  })

  it("moves the edited time when a commit with a once key lands", async () => {
    const named = deckName()
    await open(named)
    const before = (await list()).decks.find((one) => one.deck === named)
    const batch = [{ value: "hi", node: "258.7" }]
    await ask(base, "POST", "/decks/commit", { deck: named, batch, once: "moves" }, cookie)
    const after = (await list()).decks.find((one) => one.deck === named)
    expect(millis(after?.edited)).toBeGreaterThan(millis(before?.edited))
  })

  it("keeps the created time when the deck is opened again", async () => {
    const named = deckName()
    await open(named)
    const before = (await list()).decks.find((one) => one.deck === named)
    await open(named)
    await open(named)
    const after = (await list()).decks.find((one) => one.deck === named)
    expect(after?.created).toBe(before?.created)
    expect(after?.edited).toBe(before?.edited)
  })

  it("keeps a deck older than 30 days that is not in Trash when the list is read", async () => {
    const named = deckName()
    await open(named)
    await admin.query(
      "update deck.saved set created = now() - interval '40 days', edited = now() - interval '40 days' where id = $1",
      [named],
    )
    const listed = await list()
    expect(listed.decks.map((entry) => entry.deck)).toContain(named)
    expect(await row(named)).toBeDefined()
  })

  it("drops a deck from Trash after 30 days and 1 minute and keeps one at 29 days and 23 hours", async () => {
    const gone = deckName()
    const kept = deckName()
    await open(gone)
    await open(kept)
    await ask(base, "POST", "/decks/trash", { deck: gone }, cookie)
    await ask(base, "POST", "/decks/trash", { deck: kept }, cookie)
    await admin.query("update deck.saved set trashed = now() - interval '30 days 1 minute' where id = $1", [gone])
    await admin.query("update deck.saved set trashed = now() - interval '29 days 23 hours' where id = $1", [kept])
    const listed = await list()
    expect(listed.trash.map((entry) => entry.deck)).toContain(kept)
    expect(listed.trash.map((entry) => entry.deck)).not.toContain(gone)
    expect(await row(gone)).toBeUndefined()
  })

  it("deletes a deck for good while a commit with once is landing", async () => {
    const named = deckName()
    await open(named)
    await ask(base, "POST", "/decks/trash", { deck: named }, cookie)
    const info = await postgresInfo()
    const holder = new Client({ connectionString: info.deck, application_name: "list-holder" })
    await holder.connect()
    try {
      await holder.query("begin")
      await holder.query("update deck.saved set revision = revision where id = $1", [named])
      const commit = ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named, batch: [{ value: "first", node: "258.7" }], once: "race" },
        cookie,
      )
      await waiters(1)
      const deleted = ask(base, "POST", "/decks/delete", { decks: [named] }, cookie)
      await waiters(2)
      await holder.query("commit")
      expect((await commit).json).toEqual({ ok: true, deck: named, revision: 1, key: `${named}:1` })
      expect((await deleted).json).toEqual({ ok: true, deleted: [named] })
    } finally {
      await holder.query("rollback").catch(() => undefined)
      await holder.end()
    }
    expect(await onceCount(named)).toBe(0)
    await open(named)
    const again = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named, batch: [{ value: "second", node: "258.7" }], once: "race" },
      cookie,
    )
    expect(again.json).toEqual({ ok: true, deck: named, revision: 1, key: `${named}:1` })
    const read = await ask(base, "POST", "/decks/open", { deck: named }, cookie)
    const register = (read.json as { register: { elements: Record<string, { landed: { value: string }[] }> } }).register
    expect(register.elements["258.7"]?.landed.map((one) => one.value)).toEqual(["second"])
  })

  it("lets the listen role read the list columns and nothing else", async () => {
    const info = await postgresInfo()
    const listen = new Client({ connectionString: info.listen })
    await listen.connect()
    try {
      await expect(listen.query("select id, name, trashed from deck.saved limit 1")).resolves.toBeDefined()
      await expect(listen.query("update deck.saved set trashed = now()")).rejects.toThrow(/permission denied/)
      await expect(listen.query("delete from deck.saved")).rejects.toThrow(/permission denied/)
    } finally {
      await listen.end()
    }
  })
})
