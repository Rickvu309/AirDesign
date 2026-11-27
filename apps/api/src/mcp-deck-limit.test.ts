import { randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { deckLimit } from "./testing/mcp-expected.js"
import { postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Answer = Record<string, any>

describe("the deck limit through mcp", () => {
  const mails: Mail[] = []
  let base = ""
  let clock = 1_000_000
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-deck-limit-session")
    const deck = openPool(info.deck, "mcp-deck-limit-deck")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      session,
      deck,
      listen,
      now: () => clock,
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

  it("refuses the sixth deck an agent makes in one minute, makes none for it, and makes one once the minute has passed", async () => {
    const cookie = await signInByCode(base, mails, `decks${randomBytes(4).toString("hex")}@example.com`)
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    const call = (name: string, args: Record<string, unknown>) =>
      client.callTool({ name: `airdesign_${name}`, arguments: args })
    const create = (name: string) => call("execute", { script: `createDeck(${JSON.stringify({ name })})` })
    try {
      for (let deck = 1; deck <= 5; deck += 1) expect((await create(`Deck ${String(deck)}`)).isError).toBeFalsy()
      const sixth = await create("Deck 6")
      expect(sixth.isError).toBe(true)
      expect(sixth.structuredContent).toEqual({ ok: false, refusal: "rate", note: deckLimit })
      expect(((await call("get_app_state", {})).structuredContent as Answer).decks).toHaveLength(5)
      clock += 60_000
      expect((await create("Deck 6")).isError).toBeFalsy()
    } finally {
      await client.close()
    }
  })
})
