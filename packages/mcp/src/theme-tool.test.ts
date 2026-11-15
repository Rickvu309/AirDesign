import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, themeNode } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const red = "C00000"
const palette = { slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" }, map: { tx1: "dk1", bg1: "lt1" } }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = { node: elementId("256.2"), kind: "shape", value: "Title", box: null, grouped: false } as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      format: 2,
      once: "index",
      offset: 0,
      total: 1,
      palettes: [palette],
      slides: [{ id: "256", position: 0 }],
      elements: [title],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}

it("lets an agent change the theme's colours and fonts with set, read them back, and lose them to run Undo", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const onShape = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "256.2", theme: { accent1: `#${red}` } }] },
    })
    expect(onShape.isError).toBe(true)
    expect(JSON.stringify(onShape.content)).toContain("Send theme with target deck.theme.")
    const theme = { accent1: `#${red.toLowerCase()}`, major: "Georgia" }
    const set = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "deck.theme", theme }] },
    })
    expect(set.isError).not.toBe(true)
    const body = held.deck.register.elements[themeNode]
    expect(body === undefined ? undefined : landedPatch(body, "text").theme).toEqual({
      accent1: { set: "C00000" },
      major: { set: "Georgia" },
    })
    const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
    expect(read.structuredContent).toMatchObject({
      palettes: [{ slots: { accent1: "C00000" } }],
      theme: { accent1: `#${red}`, major: "Georgia" },
      elements: [{ node: "256.2" }],
    })
    const undone = call("undo_run", held.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    if (!undone.ok) throw new Error(undone.refusal)
    const after = readDeckPage(undone.deck, { runId: null })
    expect(after.palettes).toEqual([palette])
    expect(after).not.toHaveProperty("theme")
  } finally {
    await client.close()
  }
})
