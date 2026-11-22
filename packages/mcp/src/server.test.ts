import { catalog, onceMeta, projectTools } from "@airdesign/catalog"
import { bytesOf, doom } from "@airdesign/document"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { memoryDecks } from "./memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom
}

function sessionFor(): Session {
  return { agent: "aira", mint: () => "minted", log: emptyLog(), now: 0 }
}

async function withClient(session: Session, host: Host, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session, host)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

describe("createServer", () => {
  it("returns a new server on every call", () => {
    const session = sessionFor()
    expect(createServer(session, memoryDecks(started))).not.toBe(createServer(session, memoryDecks(started)))
  })

  it("lists the five tools within 8,000 tokens, each as the catalog describes it", async () => {
    const projected = projectTools(catalog)
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      expect(client.getServerVersion()?.name).toBe("airdesign")
      const { tools } = await client.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(projected.map((tool) => tool.name))
      expect(tools.map((tool) => tool.name)).toEqual([
        "airdesign_create_deck",
        "airdesign_edit_deck",
        "airdesign_list_decks",
        "airdesign_read_deck",
        "airdesign_stop_run",
      ])
      for (const [index, tool] of tools.entries()) {
        const expected = projected[index]!
        expect(tool.description).toBe(expected.description)
        expect(tool.annotations).toEqual({
          readOnlyHint: expected.readOnlyHint,
          destructiveHint: expected.destructiveHint,
          idempotentHint: expected.idempotentHint,
          openWorldHint: expected.openWorldHint,
        })
      }
      const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")!
      const schema = edit.inputSchema as {
        required?: string[]
        $defs?: { change?: { properties?: { op?: { enum?: string[] } } } }
      }
      expect(schema.required).toEqual(["deck", "base", "changes"])
      expect(schema.$defs?.change?.properties?.op?.enum).toEqual([
        "add",
        "set",
        "move",
        "wrap",
        "unwrap",
        "delete",
        "slide",
      ])
      const advertised = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }))
      expect(Math.ceil(bytesOf(JSON.stringify(advertised)) / 4)).toBeLessThanOrEqual(8000)
      expect(Math.ceil(bytesOf(JSON.stringify(await client.listTools())) / 4)).toBeLessThanOrEqual(8000)
      expect(tools.every((tool) => !Object.hasOwn(tool, "outputSchema"))).toBe(true)
    })
  })

  it("builds the board deck brief in six calls over the protocol", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const call = async (name: string, args: unknown) => {
        const result = await client.callTool({ name: `airdesign_${name}`, arguments: args as Record<string, unknown> })
        expect(result.isError, JSON.stringify(result.content)).not.toBe(true)
        return result.structuredContent as Record<string, any>
      }
      const made = await call("create_deck", { name: "Board" })
      const deck = made.deck as string
      const first = made.slides[0] as string
      const slides = await call("edit_deck", {
        deck,
        base: made.rev,
        changes: Array.from({ length: 4 }, () => ({ op: "slide", add: {} })),
      })
      const read = await call("read_deck", { deck })
      const [, two, three, four, five] = read.slides as string[]
      const filled = await call("edit_deck", {
        deck,
        base: slides.rev,
        runId: slides.runId,
        changes: [
          { op: "add", kind: "text", slide: first, text: "Q3 board update", textStyle: "title" },
          { op: "add", kind: "kpi", slide: two, items: [{ title: "Revenue", value: "$4.2M" }] },
          {
            op: "add",
            kind: "chart",
            slide: three,
            chart: { kind: "bar", categories: ["Q1"], series: [{ name: "Plan", values: [3] }] },
          },
          {
            op: "add",
            kind: "cards",
            slide: four,
            items: [{ title: "Grow", icon: "trending-up", points: ["Enter two markets"] }],
          },
          {
            op: "add",
            kind: "frame",
            slide: five,
            rows: [
              ["", "Q1"],
              ["Product", "Beta"],
            ],
          },
        ],
      })
      await call("stop_run", { deck, runId: filled.runId })
      await call("read_deck", { deck })
    })
  })

  it("takes the once an agent names in the call's meta, and refuses one in the wrong form", async () => {
    const decks = memoryDecks(started)
    await withClient(sessionFor(), decks, async (client) => {
      const once = (value: unknown) => ({ _meta: { [onceMeta]: value } })
      const first = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("make-1") })
      const again = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("make-1") })
      expect(again.structuredContent).toEqual(first.structuredContent)
      expect(decks.decks.size).toBe(1)
      const bad = await client.callTool({ name: "airdesign_create_deck", arguments: {}, ...once("not allowed!") })
      expect(bad.isError).toBe(true)
      expect(bad.structuredContent).toEqual({ ok: false, refusal: "field" })
    })
  })

  it("answers a refusal as an error with the answer as its structured content", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const refused = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "nothere" } })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toEqual({ ok: false, refusal: "deck" })
      expect(refused.content).toHaveLength(2)
    })
  })
})

describe("a host that admits each tool call", () => {
  it("is asked for every call, and a refusal answers the host's text and changes nothing", async () => {
    const decks = memoryDecks(started)
    const asked: number[] = []
    const text = "Thirty tool calls in five minutes. The next tool call can run in 12 seconds." as const
    const host: Host = {
      ...decks,
      admit: async (seen) => {
        asked.push(seen.now)
        return asked.length === 1
          ? { ok: true, log: emptyLog() }
          : { ok: false, log: emptyLog(), text, resetsAt: 12_000 }
      },
    }
    await withClient(sessionFor(), host, async (client) => {
      const made = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(made.isError).not.toBe(true)
      const refused = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text }])
    })
    expect(asked).toEqual([0, 0])
    expect(decks.decks.size).toBe(1)
  })

  it("answers a store refusal when the host cannot admit a call", async () => {
    const decks = memoryDecks(started)
    const host: Host = { ...decks, admit: () => Promise.reject(new Error("connect ECONNREFUSED")) }
    await withClient(sessionFor(), host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_create_deck", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.structuredContent).toEqual({ ok: false, refusal: "store" })
    })
    expect(decks.decks.size).toBe(0)
  })

  it("counts calls in the session's own log when the host does not admit", async () => {
    const session = sessionFor()
    await withClient(session, memoryDecks(started), async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const listed = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
        expect(listed.isError).not.toBe(true)
      }
      const refused = await client.callTool({ name: "airdesign_list_decks", arguments: {} })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([
        { type: "text", text: "Thirty tool calls in five minutes. The next tool call can run in 300 seconds." },
      ])
    })
  })
})
