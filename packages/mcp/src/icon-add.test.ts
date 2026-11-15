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

describe("an agent places a Lucide icon by name", () => {
  it("adds a one-inch picture whose opening source is the icon, then sets its alt text", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const added = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "add", kind: "picture", slide: "256", icon: "rocket" }] },
      })
      expect(added.isError).not.toBe(true)
      const command = held.deck.register.order.at(-1)
      expect(command).toMatchObject({
        slide: "element-add",
        element: { node: "256.5", kind: "picture", value: null, opening: { image: { source: { set: "rocket" } } } },
      })
      const placed = command?.slide === "element-add" ? command.element.box : null
      expect(placed).toMatchObject({ cx: 914_400, cy: 914_400 })
      const alt = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: held.deck.revision,
          changes: [{ op: "set", target: "256.5", identity: { alt: "A rocket lifting off" } }],
        },
      })
      expect(alt.isError).not.toBe(true)
      const read = readDeckPage(held.deck, { runId: "run", slide: "256" })
      expect(read.elements.find((element) => element.node === "256.5")).toMatchObject({
        kind: "picture",
        design: "image.source rocket · identity.alt A rocket lifting off",
      })
    })
  })

  it("refuses a name Lucide does not have, with close names, and lands nothing", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "add", kind: "picture", slide: "256", icon: "rockets" }] },
      })
      expect(refused.isError).toBe(true)
      const texts = (refused.content as readonly { readonly text: string }[]).map((block) => block.text)
      expect(texts[1]).toBe(
        'Change 1: icon is missing or has the wrong form. No Lucide icon is named "rockets". Close names: rocket.',
      )
      const swapped = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "256.2", image: { source: "zzzz" } }] },
      })
      expect(JSON.stringify(swapped.content)).toContain("none is close")
    })
    expect(held.deck.register.order).toEqual([])
  })
})
