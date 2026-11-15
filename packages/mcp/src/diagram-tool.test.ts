import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { indexDeck, openDeck, readDeckPage } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }])
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, size, free: 5, animated: [], layout: [] }],
      elements: [{ node: elementId("256.2"), kind: "shape", value: title, box, grouped: false }],
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

describe("an agent builds a diagram with one edit", () => {
  it("lands three labelled shapes, two attached arrows and a group, and names every new id in elements", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const made = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: [{ op: "diagram", slide: "256", labels: ["Plan", "Build", "Ship"] }],
        },
      })
      expect(made.isError).not.toBe(true)
      const answer = made.structuredContent as { readonly elements: readonly { readonly node: string }[] }
      expect(answer.elements.map((element) => element.node).toSorted()).toEqual([
        "256.10",
        "256.5",
        "256.6",
        "256.7",
        "256.8",
        "256.9",
      ])
      const read = readDeckPage(held.deck, { runId: "run", slide: "256" })
      expect(read.elements.find((element) => element.node === "256.8")?.design).toContain(
        "connection.start 256.5 site 3 · connection.end 256.6 site 1",
      )
    })
  })
})
