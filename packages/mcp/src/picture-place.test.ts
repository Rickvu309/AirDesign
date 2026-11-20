import { readDeckId } from "@airdesign/catalog"
import { elementId } from "@airdesign/document"
import { indexDeck, openDeck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 1_524_000, y: 1_122_363, cx: 4_572_000, cy: 3_048_000 }

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
      total: 1,
      slides: [
        { id: "256", position: 0, size, free: 5, animated: [], layout: [] },
        { id: "257", position: 1, size, free: 2, animated: [], layout: [] },
      ],
      elements: [{ node: elementId("256.4"), kind: "shape", value: null, box, grouped: false }],
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

describe("an agent places an image already in the deck and fits and crops it", () => {
  it("copies the image layer onto another slide, then sets its fill mode and crop", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const copied = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: [{ op: "duplicate", elements: ["256.4"], slide: "257", x: 72, y: 72 }],
        },
      })
      expect(copied.isError).not.toBe(true)
      const clone = held.deck.register.order.at(-1)
      expect(clone).toMatchObject({ slide: "element-clone", id: "257", source: "256.4" })
      const node = clone?.slide === "element-clone" ? clone.element.node : null
      expect(node).toBe("257.2")
      const fitted = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: held.deck.revision,
          changes: [
            { op: "set", target: node, fills: { mode: "fit" } },
            { op: "set", target: node, fills: { crop: { l: 10, t: 0, r: 10, b: 0 } } },
          ],
        },
      })
      expect(fitted.isError).not.toBe(true)
      const landed = node === null ? [] : (held.deck.register.elements[node]?.landed ?? [])
      expect(landed.map((row) => ("patch" in row ? row.patch.fills : undefined))).toEqual([
        { mode: { set: "fit" } },
        { crop: { set: { l: 10_000, t: 0, r: 10_000, b: 0 } } },
      ])
    })
  })
})
