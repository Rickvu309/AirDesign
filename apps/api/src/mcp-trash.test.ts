import { scriptOf } from "@airdesign/agent/testing/evals"
import { randomBytes } from "node:crypto"

import { deckRoutes } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Answer = Record<string, any>

describe("a trashed deck through mcp", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-trash-session")
    const deck = openPool(info.deck, "mcp-trash-deck")
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

  it("is left out of the list and refused to a read and an edit", async () => {
    const cookie = await signInByCode(base, mails, `trash${randomBytes(4).toString("hex")}@example.com`)
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    const tool = async (name: string, args: Record<string, unknown>) =>
      (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Answer
    try {
      const kept = await tool("execute", { script: 'createDeck({ name: "Kept" })' })
      const thrown = await tool("execute", { script: 'createDeck({ name: "Thrown" })' })
      expect((await ask(base, "POST", deckRoutes.trash.path, { deck: thrown.deck }, cookie)).json).toMatchObject({
        ok: true,
      })
      expect((await tool("get_app_state", {})).decks).toEqual([{ deck: kept.deck, name: "Kept", rev: kept.rev }])
      expect(await tool("execute", { deck: thrown.deck, script: "get()" })).toMatchObject({
        ok: false,
        refusal: "deck",
      })
      const changes = [{ op: "insert", kind: "text", parent: thrown.slides[0], text: "in the trash" }]
      expect(await tool("execute", { deck: thrown.deck, script: scriptOf(changes) })).toMatchObject({
        ok: false,
        refusal: "deck",
      })
    } finally {
      await client.close()
    }
  })
})
