import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { call, indexDeck, openDeck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const square = { cx: 1_000_000, cy: 1_000_000 }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 2,
      slides: [{ id: "256", position: 0, size, free: 5, animated: [], layout: [] }],
      elements: [
        {
          node: elementId("256.2"),
          kind: "shape",
          value: "",
          box: { x: 1_000_000, y: 1_000_000, ...square },
          grouped: false,
        },
        {
          node: elementId("256.3"),
          kind: "shape",
          value: "",
          box: { x: 4_000_000, y: 1_000_000, ...square },
          grouped: false,
        },
      ],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}

async function withClient(held: Session, use: (client: Client) => Promise<void>) {
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

describe("an agent sends an old base", () => {
  it("is told the deck moved past its base and given the revision to send, not that a layer changed", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const first = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "256.2", opacity: 50 }] },
      })
      expect(first.isError).not.toBe(true)
      const person = call(
        "commit_edits",
        held.deck,
        { actor: "person" },
        {
          deck: "deck",
          batch: [{ node: "256.3", value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Person" }] }]) }],
        },
      )
      if (!person.ok) throw new Error(person.refusal)
      held.deck = person.deck
      const old = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 1, changes: [{ op: "set", target: "256.2", opacity: 40 }] },
      })
      expect(old.isError).toBe(true)
      expect(old.structuredContent).toMatchObject({ ok: false, refusal: "stale", revision: 2 })
      const words = (old.content as readonly { readonly text: string }[]).map((part) => part.text).join(" ")
      expect(words).toContain("The deck moved past base")
      expect(words).toContain("Use the revision in this answer as base")
    })
  })
})
