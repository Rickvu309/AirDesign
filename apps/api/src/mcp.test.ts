import { randomBytes } from "node:crypto"

import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { agentEdit } from "./agent-edit.js"
import { ask, cookieFrom, postgresInfo, serve } from "./harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

function deckName(): string {
  return `deck${randomBytes(4).toString("hex")}`
}

function address(mark: string): string {
  return `${mark}${randomBytes(4).toString("hex")}@example.com`
}

type Stored = {
  revision: number
  register: {
    runId: string | null
    landed: { value: string }[]
  }
}

const toolLimit = "Thirty tool calls in five minutes. The next tool call can run at 1300000."
const captureNext = "Open the deck in AirDesign, then try again."

describe("mcp route", () => {
  const mails: Mail[] = []
  let base = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    const session = openPool(info.session, "mcp-session")
    deck = openPool(info.deck, "mcp-handler")
    const listen = new DeckListen(info.listen)
    const served = await serve({
      session,
      deck,
      listen,
      now: () => 1_000_000,
      send: async (mail) => {
        mails.push(mail)
      },
    })
    base = served.base
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

  async function row(id: string): Promise<Stored | undefined> {
    const result = await deck.query<Stored>("select revision, register from deck.saved where id = $1", [id])
    return result.rows[0]
  }

  async function withMcp(cookie: string, use: (client: Client) => Promise<void>): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { cookie } },
    })
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(transport)
    try {
      await use(client)
    } finally {
      await client.close()
    }
  }

  it("refuses mcp without a session", async () => {
    const missing = await ask(base, "POST", "/mcp", {})
    const unknown = await ask(base, "POST", "/mcp", {}, "airdesign.session=missing")
    expect(missing.status).toBe(401)
    expect(missing.json).toEqual({ ok: false, refusal: "session" })
    expect(unknown.status).toBe(401)
    expect(unknown.json).toEqual({ ok: false, refusal: "session" })
  })

  it("lands two edits in one run and keeps the server run id", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const email = address("land")
    const firstCookie = await sign(email)
    const opened = await ask(base, "POST", "/decks/open", { deck: named.deck }, firstCookie)
    expect(opened.json).toMatchObject({ ok: true, revision: 0 })
    await withMcp(firstCookie, async (client) => {
      const listed = await client.listTools()
      const estimate = Math.ceil(Buffer.byteLength(JSON.stringify({ tools: listed.tools })) / 4)
      expect(listed.tools.length).toBe(projectTools(catalog).length)
      expect(listed.tools.length).toBeLessThanOrEqual(20)
      expect(estimate).toBeLessThanOrEqual(8000)
      const first = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.first(named.deck),
      })
      expect(first.isError).not.toBe(true)
      expect(first.content).toEqual([{ type: "text", text: "Landed revision 1." }])
      const started = await row(named.deck)
      expect(started?.revision).toBe(1)
      expect(started?.register.landed.map((item) => item.value)).toEqual(["21"])
      const runId = started?.register.runId
      expect(runId).toEqual(expect.any(String))
      expect(runId).not.toBe("server")
      const secondCookie = await sign(email)
      const seen = await ask(base, "POST", "/decks/open", { deck: named.deck }, secondCookie)
      expect(seen.status).toBe(200)
      expect(seen.json).toMatchObject({
        ok: true,
        deck: named.deck,
        revision: 1,
        register: { runId, landed: [{ actor: "agent", value: "21", visible: true }] },
      })
      const second = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.second(named.deck),
      })
      expect(second.isError).not.toBe(true)
      expect(second.content).toEqual([{ type: "text", text: "Landed revision 2." }])
      const kept = await row(named.deck)
      expect(kept?.revision).toBe(2)
      expect(kept?.register.landed.map((item) => item.value)).toEqual(["21", "22"])
      expect(kept?.register.runId).toBe(runId)
    })
  })

  it("refuses another account", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const owner = await sign(address("own"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, owner)
    await withMcp(owner, async (client) => {
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.first(named.deck),
      })
      expect(landed.content).toEqual([{ type: "text", text: "Landed revision 1." }])
    })
    const before = await row(named.deck)
    const other = await sign(address("else"))
    await withMcp(other, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.other(named.deck),
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text: "owner" }])
    })
    expect(await row(named.deck)).toEqual(before)
  })

  it("refuses a client run id and leaves the stored run", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("id"))
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await withMcp(cookie, async (client) => {
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.first(named.deck),
      })
      expect(landed.content).toEqual([{ type: "text", text: "Landed revision 1." }])
      const started = await row(named.deck)
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.claimed(named.deck),
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text: "field" }])
      const kept = await row(named.deck)
      expect(kept).toEqual(started)
      expect(kept?.register.runId).not.toBe("client-run")
      expect(kept?.register.landed.map((item) => item.value)).toEqual(["21"])
    })
  })

  it("refuses a deck that was never opened", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const cookie = await sign(address("miss"))
    await withMcp(cookie, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.first(named.deck),
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text: "deck" }])
    })
    const counted = await deck.query<{ count: string }>(
      "select count(*)::text as count from deck.saved where id = $1",
      [named.deck],
    )
    expect(counted.rows[0]?.count).toBe("0")
  })

  it("refuses the thirty-first tool call after a new sign-in", async () => {
    const named = readDeckId(deckName())
    if (!named.ok) throw new Error(named.refusal)
    const email = address("cap")
    const cookie = await sign(email)
    await ask(base, "POST", "/decks/open", { deck: named.deck }, cookie)
    await withMcp(cookie, async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const captured = await client.callTool({
          name: "airdesign_capture_slide",
          arguments: { deck: named.deck },
        })
        expect(captured.isError).toBe(true)
        expect(captured.content).toEqual([{ type: "text", text: captureNext }])
      }
      const blocked = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: agentEdit.first(named.deck),
      })
      expect(blocked.isError).toBe(true)
      expect(blocked.content).toEqual([{ type: "text", text: toolLimit }])
    })
    const kept = await row(named.deck)
    expect(kept?.revision).toBe(0)
    expect(kept?.register.landed).toEqual([])
    const again = await sign(email)
    await withMcp(again, async (client) => {
      const blocked = await client.callTool({
        name: "airdesign_capture_slide",
        arguments: { deck: named.deck },
      })
      expect(blocked.isError).toBe(true)
      expect(blocked.content).toEqual([{ type: "text", text: toolLimit }])
    })
    expect(await row(named.deck)).toEqual(kept)
  })
})
