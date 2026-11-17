import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { indexDeck, openDeck, type Deck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { admit, createServer, editNext, emptyLog, memoryTurns, type Host, type Session } from "./index.js"

const slideCalls = [
  ["add_slide", { after: "256", layout: "256" }],
  ["duplicate_slide", { slide: "256" }],
  ["delete_slide", { slide: "256" }],
  ["move_slide", { slide: "256", after: null }],
  ["add", { kind: "shape", slide: "256" }],
  ["delete", { node: "256.2" }],
] as const

function unindexed(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  return openDeck(id.deck)
}

function indexed(deck: Deck): Deck {
  const row = {
    node: elementId("256.2"),
    kind: "shape",
    value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
    box: null,
    grouped: false,
  } as const
  const result = indexDeck(
    deck,
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [row] }],
      elements: [row],
    },
  )
  if (!result.ok) throw new Error(result.refusal)
  return result.deck
}

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

async function withClient(session: Session, host: Host | undefined, use: (client: Client) => Promise<void>) {
  const server = createServer(session, host)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(b)
  await client.connect(a)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

describe("a slide call that arrives before the deck's index", () => {
  for (const [name, input] of slideCalls) {
    it(`${name} is refused as indexing, with words an agent can act on, and costs no tool call`, async () => {
      const session = sessionFor(unindexed())
      await withClient(session, undefined, async (client) => {
        const refused = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: 0, changes: [{ op: name, ...input }] },
        })
        expect(refused.isError).toBe(true)
        expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "indexing" })
        expect(refused.content).toEqual([
          { type: "text", text: editNext.indexing },
          { type: "text", text: JSON.stringify(refused.structuredContent) },
        ])
      })
      expect(editNext.indexing).toContain("still being indexed")
      expect(editNext.indexing).toContain("airdesign_read_deck")
      expect(session.log.events).toEqual([])
      expect(session.deck.revision).toBe(0)
    })
  }

  it("is sent again after the index lands, and that call lands", async () => {
    const session = sessionFor(unindexed())
    await withClient(session, undefined, async (client) => {
      const arguments_ = { deck: "deck", base: 0, changes: [{ op: "add_slide", after: "256", layout: "256" }] }
      const first = await client.callTool({ name: "airdesign_edit_deck", arguments: arguments_ })
      expect(first.isError).toBe(true)
      session.deck = indexed(session.deck)
      const second = await client.callTool({ name: "airdesign_edit_deck", arguments: arguments_ })
      expect(second.isError).not.toBe(true)
      expect(second.structuredContent).toMatchObject({ ok: true, slides: ["257"] })
    })
    expect(session.log.events).toHaveLength(1)
  })

  it("asks the host to give the admission back when the host counts calls", async () => {
    const session = sessionFor(unindexed())
    const counted: string[] = []
    const host: Host = {
      admit: async (seen) => {
        counted.push("admit")
        return admit(seen.log, "tool", seen.now)
      },
      refund: async () => {
        counted.push("refund")
      },
    }
    await withClient(session, host, async (client) => {
      await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "add_slide", after: "256", layout: "256" }] },
      })
    })
    expect(counted).toEqual(["admit", "refund"])
  })

  it("keeps a refusal for any other reason counted", async () => {
    const session = sessionFor(unindexed())
    await withClient(session, undefined, async (client) => {
      await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "other", base: 0, changes: [{ op: "add_slide", after: "1", layout: "1" }] },
      })
    })
    expect(session.log.events).toHaveLength(1)
  })
})
