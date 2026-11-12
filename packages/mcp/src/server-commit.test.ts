import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"

import { commitTries, createServer, editNext, emptyLog, memoryTurns, type Host, type Session } from "./index.js"

const edit = { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] }

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
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

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

describe("a host whose store was written by someone else before the commit", () => {
  it("reads the deck again and runs the call again, and answers what the last commit settled", async () => {
    const session = sessionFor(opened())
    const prepared: number[] = []
    const host: Host = {
      prepare: async () => {
        prepared.push(prepared.length)
        return { ok: true }
      },
      commit: async (result) => (prepared.length < 2 ? { lost: result } : result),
    }
    await withClient(session, host, async (client) => {
      const landed = await client.callTool({ name: "airdesign_edit_deck", arguments: edit })
      expect(landed.isError).not.toBe(true)
    })
    expect(prepared).toEqual([0, 1])
    expect(session.deck.revision).toBe(1)
    expect(session.log.events.filter((event) => event.kind === "tool")).toHaveLength(1)
  })

  it("stops after the tries and answers the refusal the host kept for it, leaving the deck as it was", async () => {
    const session = sessionFor(opened())
    let tries = 0
    const host: Host = {
      commit: async (result) => {
        tries += 1
        return {
          lost: {
            ok: false,
            refusal: "stale",
            deck: result.deck,
            content: [{ type: "text", text: editNext.stale }],
          },
        }
      },
    }
    await withClient(session, host, async (client) => {
      const refused = await client.callTool({ name: "airdesign_edit_deck", arguments: edit })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([{ type: "text", text: editNext.stale }])
    })
    expect(tries).toBe(commitTries)
    expect(session.deck.revision).toBe(0)
    expect(session.log.events.filter((event) => event.kind === "tool")).toHaveLength(1)
  })
})

describe("a host that saves the turn in a store", () => {
  it("answers a call only after the host has saved the turn it settled", async () => {
    const session = sessionFor(opened())
    let reach = () => {}
    let release = () => {}
    const reached = new Promise<void>((resolve) => {
      reach = resolve
    })
    const saving = new Promise<void>((resolve) => {
      release = resolve
    })
    const host: Host = {
      turnSaved: () => {
        reach()
        return saving
      },
    }
    await withClient(session, host, async (client) => {
      let answered = false
      const call = client.callTool({ name: "airdesign_edit_deck", arguments: edit }).then((result) => {
        answered = true
        return result
      })
      expect(await Promise.race([reached.then(() => "saving"), call.then(() => "answered")])).toBe("saving")
      await client.listTools()
      expect(answered).toBe(false)
      release()
      expect((await call).isError).not.toBe(true)
    })
    expect(session.turns.read(session.deck.id)?.revision).toBe(1)
  })
})
