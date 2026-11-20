import { randomBytes } from "node:crypto"
import { readDeckId } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { heldRevision } from "./deck-watch.js"
import * as saved from "./saved.js"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"
import { readSignInMail } from "./sign-in-mail.js"

describe("lost acknowledgment", () => {
  const mails: Mail[] = []
  let base = ""
  let cookie = ""
  let email = ""
  let close = async () => {}
  let listen = new DeckListen("postgres://listen@127.0.0.1/api")
  let deck = openPool("postgres://deck@127.0.0.1/api")

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "catch-session")
    deck = openPool(info.deck, "catch-deck")
    listen = new DeckListen(info.listen)
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
    email = `person${randomBytes(4).toString("hex")}@example.com`
    await ask(base, "POST", "/sign-in/email", { email })
    const { code } = readSignInMail(mails[0]?.text ?? "")
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

  it("reads the committed revision from the table when the listen client was down", async () => {
    const named = readDeckId(`catch${randomBytes(4).toString("hex")}`)
    if (!named.ok) throw new Error(named.refusal)
    await listen.ready()
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await listen.close()
    const committed = await ask(
      base,
      "POST",
      "/decks/commit",
      { deck: named.deck, batch: [{ value: "hi", node: "258.7" }] },
      cookie,
    )
    expect(committed.status).toBe(200)
    void committed.text
    await listen.open()
    expect(listen.revisions()).toContainEqual({ id: named.deck, revision: 1 })
    const watched = await ask(base, "POST", "/decks/watch", { deck: named.deck, cursor: 0 }, cookie)
    expect(watched.json).toEqual({ ok: true, deck: named.deck, revision: 1 })
  })

  it("follows a revision committed while the watch reads the previous one", async ({ signal }) => {
    const named = readDeckId(`catch${randomBytes(4).toString("hex")}`)
    if (!named.ok) throw new Error(named.refusal)
    await listen.ready()
    const created = listen.wait(signal)
    const opened = await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    expect(opened.json).toMatchObject({ ok: true, revision: 0 })
    await created
    const readSaved = saved.readSaved
    const stale = vi.spyOn(saved, "readSaved").mockImplementationOnce(async (db, id) => {
      const previous = await readSaved(db, id)
      const notified = listen.wait(signal)
      const committed = await ask(
        base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: "new", node: "258.7" }] },
        cookie,
      )
      expect(committed.json).toMatchObject({ ok: true, revision: 1 })
      await notified
      return previous
    })
    try {
      await expect(heldRevision({ listen, deck }, named.deck, 0, email, signal)).resolves.toBe(1)
    } finally {
      stale.mockRestore()
    }
  })
})
