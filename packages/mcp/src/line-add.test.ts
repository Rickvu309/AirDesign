import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { indexDeck, openDeck, readDeckPage } from "@airdesign/engine"
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

describe("an agent adds an arrow with one edit", () => {
  it("joins two shapes right site to left site and names the new id in elements", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const connection = { start: { shape: { node: "256.2", site: 3 } }, end: { shape: { node: "256.3", site: 1 } } }
      const made = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "add", kind: "arrow", slide: "256", connection }] },
      })
      expect(made.isError).not.toBe(true)
      const answer = made.structuredContent as { readonly elements: readonly { readonly node: string }[] }
      expect(answer.elements.map((element) => element.node)).toEqual(["256.5"])
      const read = readDeckPage(held.deck, { runId: "run", slide: "256" }).elements.find(
        (each) => each.node === "256.5",
      )
      expect(read).toMatchObject({ kind: "connector", box: { x: 157.5, y: 118.1, w: 157.5, h: 0 } })
      expect(read?.design).toContain("connection.start 256.2 site 3 · connection.end 256.3 site 1")
    })
  })
})
