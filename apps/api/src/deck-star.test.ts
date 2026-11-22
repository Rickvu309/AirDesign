import { randomBytes } from "node:crypto"
import { deckRoutes } from "@airdesign/catalog"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, signInByCode, postgresInfo, serve } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Row = { deck: string; starred?: boolean }
type Listed = { decks: Row[]; trash: Row[] }

function deckName(): string {
  return `deck${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

describe("deck stars", () => {
  const mails: Mail[] = []
  let base = ""
  let cookie = ""
  let admin = new Client()
  let close = async () => {}

  const sign = (email: string): Promise<string> => signInByCode(base, mails, email)

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "star-session")
    const deck = openPool(info.deck, "star-deck")
    const listen = new DeckListen(info.listen)
    admin = new Client({ connectionString: info.admin, application_name: "star-admin" })
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
    cookie = await sign(address("owner"))
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
    await ask(base, "POST", deckRoutes.open.path, { deck }, as)
  }

  async function star(deck: string, starred: boolean, as = cookie) {
    return ask(base, "POST", deckRoutes.star.path, { deck, starred }, as)
  }

  async function listed(deck: string, as = cookie): Promise<Row | undefined> {
    const answer = (await ask(base, "POST", deckRoutes.list.path, {}, as)).json as Listed
    return [...answer.decks, ...answer.trash].find((one) => one.deck === deck)
  }

  async function row(deck: string): Promise<Record<string, unknown> | undefined> {
    const found = await admin.query("select * from deck.saved where id = $1", [deck])
    return found.rows[0] as Record<string, unknown> | undefined
  }

  it("refuses a star without a session", async () => {
    const response = await ask(base, "POST", deckRoutes.star.path, { deck: "abc", starred: true })
    expect(response.status).toBe(401)
    expect(response.json).toEqual({ ok: false, refusal: "session" })
  })

  it("lists a new deck without a star, then starred, then without it again", async () => {
    const named = deckName()
    await open(named)
    expect((await listed(named))?.starred).toBe(false)
    const starred = await star(named, true)
    expect(starred.status).toBe(200)
    expect(starred.json).toEqual({ ok: true, deck: named, starred: true })
    expect((await listed(named))?.starred).toBe(true)
    expect((await star(named, false)).json).toEqual({ ok: true, deck: named, starred: false })
    expect((await listed(named))?.starred).toBe(false)
  })

  it("lists each deck and Trash row with exactly its fields, the star among them", async () => {
    const kept = deckName()
    const binned = deckName()
    await open(kept)
    await open(binned)
    await ask(base, "POST", deckRoutes.trash.path, { deck: binned }, cookie)
    expect(Object.keys((await listed(kept)) ?? {}).sort()).toEqual(["created", "deck", "edited", "name", "starred"])
    const trashed = Object.keys((await listed(binned)) ?? {}).sort()
    expect(trashed).toEqual(["created", "deck", "edited", "name", "starred", "trashed"])
  })

  it("keeps the edited time and the revision when a deck is starred", async () => {
    const named = deckName()
    await open(named)
    await ask(base, "POST", deckRoutes.commit.path, { deck: named, batch: [{ value: "hi", node: "258.7" }] }, cookie)
    const before = await row(named)
    await star(named, true)
    const after = await row(named)
    expect(after?.edited).toEqual(before?.edited)
    expect(after?.revision).toBe(before?.revision)
  })

  it("refuses a star on another account's deck the same way as on a missing one, and leaves theirs alone", async () => {
    const theirs = deckName()
    const missing = deckName()
    const otherCookie = await sign(address("other"))
    await open(theirs, otherCookie)
    const other = await star(theirs, true)
    const none = await star(missing, true)
    expect(other.status).toBe(200)
    expect(other.json).toEqual({ ok: false, refusal: "owner" })
    expect(none.json).toEqual(other.json)
    expect((await listed(theirs, otherCookie))?.starred).toBe(false)
    expect(await row(missing)).toBeUndefined()
  })

  it("shows a star only to the account that owns the deck", async () => {
    const mine = deckName()
    const otherCookie = await sign(address("second"))
    await open(mine)
    await star(mine, true)
    expect(await listed(mine, otherCookie)).toBeUndefined()
  })

  it("keeps the star of a deck in Trash and after it is restored", async () => {
    const named = deckName()
    await open(named)
    await star(named, true)
    await ask(base, "POST", deckRoutes.trash.path, { deck: named }, cookie)
    expect((await listed(named))?.starred).toBe(true)
    await ask(base, "POST", deckRoutes.restore.path, { deck: named }, cookie)
    expect((await listed(named))?.starred).toBe(true)
  })

  it("clears the star of a deck deleted for good and refuses a star on it", async () => {
    const named = deckName()
    await open(named)
    await star(named, true)
    await ask(base, "POST", deckRoutes.trash.path, { deck: named }, cookie)
    await ask(base, "POST", deckRoutes.delete.path, { decks: [named] }, cookie)
    expect((await row(named))?.starred).toBe(false)
    expect((await star(named, true)).json).toEqual({ ok: false, refusal: "deleted" })
  })

  it("refuses a body of the wrong shape and a bad deck id", async () => {
    const checks: [unknown, string][] = [
      [{ deck: "abc" }, "field"],
      [{ deck: "abc", starred: "yes" }, "field"],
      [{ deck: "abc", starred: true, name: "x" }, "field"],
      [{ deck: "bad id", starred: true }, "deck"],
    ]
    for (const [body, refusal] of checks) {
      const response = await ask(base, "POST", deckRoutes.star.path, body, cookie)
      expect(response.status).toBe(200)
      expect(response.json).toEqual({ ok: false, refusal })
    }
  })
})
