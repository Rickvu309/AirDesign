import { scriptOf } from "@airdesign/mcp/testing/evals"
import { randomBytes } from "node:crypto"

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { DeckListen, openPool, type Mail, type Sql } from "./index.js"

const origins = { publicOrigin: "https://app.example", siteOrigin: "https://site.example" }

describe("an agent's title on a deck made over MCP", () => {
  const mails: Mail[] = []
  let base = ""
  let deck: Sql = openPool("postgres://deck@127.0.0.1/api")
  let sessionDb: Sql = openPool("postgres://session@127.0.0.1/api")
  let close = async () => {}

  beforeAll(async () => {
    const info = await postgresInfo()
    sessionDb = openPool(info.session, "title-session")
    deck = openPool(info.deck, "title-handler")
    const listen = new DeckListen(info.listen)
    const send = async (mail: Mail) => {
      mails.push(mail)
    }
    const served = await serve({ ...origins, session: sessionDb, deck, listen, now: () => 1_000_000, send })
    base = served.base
    close = async () => {
      await served.close()
      await listen.close()
      await sessionDb.end()
      await deck.end()
    }
  })

  afterAll(async () => {
    await close()
  })

  async function tool(client: Client, name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name: `airdesign_${name}`, arguments: args })
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true)
    return { answer: result.structuredContent as Record<string, any>, content: result.content as { text: string }[] }
  }

  it("fills the Untitled title and the Subtitle placeholder, adds no text of its own, and names the two it filled", async () => {
    const cookie = await signInByCode(base, mails, `fill${randomBytes(4).toString("hex")}@example.com`)
    const client = new Client({ name: "airdesign-test", version: "0.0.0" })
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { cookie } } }),
    )
    try {
      const first = (await tool(client, "execute", { script: 'createDeck({ name: "Board" })' })).answer
      const read = async () =>
        (await tool(client, "execute", { deck: first.deck, script: "get().layers" })).answer.result as string
      expect(await read()).toContain("Untitled")
      const landed = await tool(client, "execute", {
        deck: first.deck,
        script: scriptOf([
          { op: "add", kind: "text", slide: first.slides[0], text: "Q3 board update", textStyle: "title" },
          { op: "add", kind: "text", slide: first.slides[0], text: "Revenue grew", textStyle: "heading" },
        ]),
      })
      const lines = await read()
      const filled = (landed.answer.made as { op: number; verb: string; ids: string[] }[]).map(({ op, verb }) => ({
        op,
        verb,
      }))
      expect(filled).toEqual([
        { op: 1, verb: "insert" },
        { op: 2, verb: "insert" },
      ])
      for (const { ids } of landed.answer.made as { ids: string[] }[]) expect(lines).toContain(`  ${ids[0]!} text`)
      expect(lines).not.toContain("Untitled")
      expect(lines).toContain("Q3 board update")
      expect(lines.split("\n").filter((line) => line.includes("text="))).toHaveLength(2)
    } finally {
      await client.close()
    }
  })
})
