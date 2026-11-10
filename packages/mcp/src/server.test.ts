import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { decide, version } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { createServer, type Session } from "./index.js"

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function running(): Deck {
  const deck = opened()
  const started = decide(deck.register, { command: "start", runId: "run" })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run", readAt: version(deck.register) }, deck }
}

function utf8Size(text: string): number {
  let size = 0
  for (const symbol of text) {
    const code = symbol.codePointAt(0) ?? 0
    if (code <= 0x7f) size += 1
    else if (code <= 0x7ff) size += 2
    else if (code <= 0xffff) size += 3
    else size += 4
  }
  return size
}

async function withClient(session: Session, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session)
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
    const session = sessionFor(opened())
    expect(createServer(session)).not.toBe(createServer(session))
  })

  it("advertises the projected tools inside the budget", async () => {
    const projected = projectTools(catalog)
    await withClient(sessionFor(opened()), async (client) => {
      expect(client.getServerVersion()?.name).toBe("airdesign")
      const { tools } = await client.listTools()
      expect(tools.length).toBe(projected.length)
      expect(tools.length).toBeLessThanOrEqual(20)
      expect(tools.map((tool) => tool.name)).toEqual(projected.map((tool) => tool.name))
      for (const [index, tool] of tools.entries()) {
        const expected = projected[index]
        if (expected === undefined) throw new Error("missing tool")
        expect(tool.description).toBe(expected.description)
        expect(tool.annotations).toEqual({
          readOnlyHint: expected.readOnlyHint,
          destructiveHint: expected.destructiveHint,
          idempotentHint: expected.idempotentHint,
          openWorldHint: expected.openWorldHint,
        })
      }
      const advertised = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }))
      const estimate = Math.ceil(utf8Size(JSON.stringify(advertised)) / 4)
      expect(estimate).toBeLessThanOrEqual(8000)
    })
  })

  it("refuses an actor on the wire and leaves the deck", async () => {
    const deck = running()
    await withClient(sessionFor(deck), async (client) => {
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21" }], actor: "person" },
      })
      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{ type: "text", text: "field" }])
      expect(deck.revision).toBe(0)
      expect(deck.register.landed).toEqual([])
    })
  })

  it("lands an edit on the wire", async () => {
    const before = running()
    const caller = { actor: "agent" as const, runId: "run", readAt: version(before.register) }
    const session: Session = { caller, deck: before }
    await withClient(session, async (client) => {
      const first = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21" }] },
      })
      expect(first.isError).not.toBe(true)
      expect(session.deck).not.toBe(before)
      expect(session.deck.revision).toBe(1)
      expect(session.deck.register.landed).toEqual([{ actor: "agent", value: "21", visible: true }])
      expect(before.revision).toBe(0)
      expect(before.register.landed).toEqual([])

      caller.readAt = version(session.deck.register)
      const second = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 1, changes: [{ value: "22" }] },
      })
      expect(second.isError).toBe(true)
      expect(second.content).toEqual([{ type: "text", text: "run-fenced" }])
      expect(session.deck.revision).toBe(1)
      expect(session.deck.register.landed.map((row) => row.value)).toEqual(["21"])
      expect(before.revision).toBe(0)
    })
  })
})
