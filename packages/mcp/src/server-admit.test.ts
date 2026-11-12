import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"

import { createServer, editNext, emptyLog, memoryTurns, type Host, type Session } from "./index.js"

const edit = { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] }

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
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

describe("a host that admits each tool call", () => {
  it("is asked for every call, and a refusal keeps the deck and answers the host's text", async () => {
    const session = sessionFor(opened())
    const asked: number[] = []
    const text = "Thirty tool calls in five minutes. The next tool call can run in 12 seconds." as const
    const host: Host = {
      admit: async (seen) => {
        asked.push(seen.now)
        return asked.length === 1
          ? { ok: true, log: emptyLog() }
          : { ok: false, log: emptyLog(), text, resetsAt: 12_000 }
      },
    }
    await withClient(session, host, async (client) => {
      const landed = await client.callTool({ name: "airdesign_edit_deck", arguments: edit })
      expect(landed.isError).not.toBe(true)
      const refused = await client.callTool({ name: "airdesign_edit_deck", arguments: { ...edit, base: 1 } })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text }])
    })
    expect(asked).toEqual([0, 0])
    expect(session.deck.revision).toBe(1)
    expect(session.log.events).toEqual([])
  })

  it("answers a store refusal and keeps the deck when the host cannot admit a call", async () => {
    const deck = opened()
    const session = sessionFor(deck)
    const host: Host = { admit: () => Promise.reject(new Error("connect ECONNREFUSED")) }
    await withClient(session, host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_edit_deck", arguments: edit })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([
        { type: "text", text: editNext.store },
        { type: "text", text: JSON.stringify({ ok: false, revision: 0, refusal: "store", elements: [] }) },
      ])
    })
    expect(session.deck).toBe(deck)
  })
})
