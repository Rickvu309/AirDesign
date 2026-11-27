import { randomBytes } from "node:crypto"

import { doomRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Answer = Record<string, any>

describe("the deck list through mcp", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-deck-list-session")
    const deck = openPool(info.deck, "mcp-deck-list-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      session,
      deck,
      listen,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
    close = async () => {
      await served.close()
      await listen.close()
      await Promise.all([session.end(), deck.end()])
    }
  })

  afterAll(async () => {
    await close()
  })

  it("lists fifty decks to a page and names the next page", async () => {
    const cookie = await signInByCode(base, mails, `page${randomBytes(4).toString("hex")}@example.com`)
    for (let made = 0; made < 51; made += 1) {
      const deck = `page${randomBytes(6).toString("hex")}`
      expect((await ask(base, "POST", doomRoutes.create.path, { deck }, cookie)).json).toMatchObject({ ok: true })
    }
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    const listed = async (args: Record<string, unknown>) =>
      (await client.callTool({ name: "airdesign_get_app_state", arguments: args })).structuredContent as Answer
    try {
      const first = await listed({})
      expect(first.decks).toHaveLength(50)
      const second = await listed({ cursor: first.next })
      expect(second.decks).toHaveLength(1)
      expect(second).not.toHaveProperty("next")
    } finally {
      await client.close()
    }
  })
})
