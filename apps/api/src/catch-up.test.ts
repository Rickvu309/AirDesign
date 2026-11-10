import { randomBytes } from "node:crypto"
import { readDeckId } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

describe("lost acknowledgment", () => {
  const mails: Mail[] = []
  let base = ""
  let cookie = ""
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
})
