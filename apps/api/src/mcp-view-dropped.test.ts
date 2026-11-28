import { randomBytes } from "node:crypto"
import { setFlagsFromString } from "node:v8"
import { runInNewContext } from "node:vm"

import { viewTools } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail } from "./index.js"

setFlagsFromString("--expose-gc")
const collectGarbage = runInNewContext("gc") as () => void

describe("a chat view's held wait for edits", () => {
  const mails: Mail[] = []
  let base = ""
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-view-dropped-session")
    const deck = openPool(info.deck, "mcp-view-dropped-deck")
    const listen = new DeckListen(info.listen)
    const api = await serve({
      publicOrigin: "https://app.example",
      siteOrigin: "https://site.example",
      session,
      deck,
      listen,
      send: async (mail) => void mails.push(mail),
    })
    base = api.base
    close = async () => {
      await api.close()
      await listen.close()
      await session.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  it("ends when the chat drops its connection, even after a garbage collection, so the deck no longer shows as open", async () => {
    const cookie = await signInByCode(base, mails, `dropped${randomBytes(4).toString("hex")}@example.com`)
    const agent = new Client({ name: "airdesign-test", version: "0.0.0" })
    await agent.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    try {
      const made = await agent.callTool({
        name: "airdesign_execute",
        arguments: { script: 'createDeck({ name: "Held" })' },
      })
      const { deck, rev } = made.structuredContent as { deck: string; rev: number }
      const openDeck = async () => {
        const state = await agent.callTool({ name: "airdesign_get_app_state", arguments: {} })
        return (state.structuredContent as { openDeck: { deck: string } | null }).openDeck?.deck ?? null
      }
      const dropped = new AbortController()
      const held = fetch(`${base}/mcp`, {
        method: "POST",
        signal: dropped.signal,
        headers: { cookie, accept: "application/json, text/event-stream", "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: viewTools.since, arguments: { deck, rev, wait: true } },
        }),
      }).catch(() => undefined)
      await expect.poll(openDeck).toBe(deck)
      collectGarbage()
      dropped.abort()
      await held
      await expect.poll(openDeck, { timeout: 2_000 }).toBeNull()
    } finally {
      await agent.close()
    }
  })
})
