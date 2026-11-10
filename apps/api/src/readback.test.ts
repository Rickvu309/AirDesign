import { randomBytes } from "node:crypto"
import { notifyKey, readDeckId } from "@airdesign/catalog"
import { call, openDeck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"

import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

function address(): string {
  return `person${randomBytes(4).toString("hex")}@example.com`
}

function deckName(): string {
  return `read${randomBytes(4).toString("hex")}`
}

describe("committed text", () => {
  it("reads one committed text back through a fresh pool", async () => {
    const info = await postgresInfo()
    const mails: Mail[] = []
    const session = openPool(info.session, "readback-session")
    const committed = openPool(info.deck, "readback-commit")
    const listen = new DeckListen(info.listen)
    const send = async (mail: Mail) => {
      mails.push(mail)
    }
    const writing = await serve({
      session,
      deck: committed,
      listen,
      send,
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
    })
    let reading: { readonly base: string; readonly close: () => Promise<void> } | undefined
    let fresh: Sql | undefined
    const text = "note"
    try {
      const email = address()
      await ask(writing.base, "POST", "/sign-in/email", { email })
      const code = mails[0]?.text.split("\n")[1]
      const signed = await ask(writing.base, "POST", "/sign-in/code", { email, code })
      const cookie = cookieFrom(signed.headers)
      if (cookie === undefined) throw new Error("cookie")
      const named = readDeckId(deckName())
      if (!named.ok) throw new Error(named.refusal)
      await ask(writing.base, "POST", "/decks/open", { deck: named.deck }, cookie)
      const wrote = await ask(
        writing.base,
        "POST",
        "/decks/commit",
        { deck: named.deck, batch: [{ value: text }] },
        cookie,
      )
      const key = notifyKey(named.deck, 1)
      if (!key.ok) throw new Error(key.refusal)
      expect(wrote.json).toEqual({ ok: true, deck: named.deck, revision: 1, key: key.key })
      await writing.close()
      await committed.end()
      fresh = openPool(info.deck, "readback-fresh")
      reading = await serve({
        session,
        deck: fresh,
        listen,
        send,
        publicOrigin: "https://app.example",
        siteOrigin: "https://site.example",
      })
      const again = await ask(reading.base, "POST", "/decks/open", { deck: named.deck }, cookie)
      const landed = call(
        "commit_edits",
        openDeck(named.deck),
        { actor: "person" },
        { deck: named.deck, batch: [{ value: text }] },
      )
      if (!landed.ok) throw new Error(landed.refusal)
      expect(landed.deck.register.landed).toEqual([{ actor: "person", value: text, visible: true }])
      expect(again.json).toEqual({
        ok: true,
        deck: named.deck,
        revision: 1,
        register: landed.deck.register,
      })
    } finally {
      await reading?.close()
      await fresh?.end()
      await writing.close().catch(() => undefined)
      await committed.end().catch(() => undefined)
      await listen.close()
      await session.end()
    }
  })
})
