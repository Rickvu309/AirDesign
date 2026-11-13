import { readDeckId } from "@airdesign/catalog"
import { elementGone, elementId, writeTextValue } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const rows = [
    {
      node: elementId("256.2"),
      kind: "shape",
      value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
      box,
      grouped: false,
    },
    { node: elementId("256.3"), kind: "shape", value: "Held", box: null, grouped: true },
    { node: elementId("256.4"), kind: "shape", value: "Moves", box: null, grouped: false },
  ] as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: rows.length,
      slides: [{ id: "256", position: 0, size, free: 5, animated: ["4"], layout: [] }],
      elements: [...rows],
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

describe("add_text_box through MCP", () => {
  it("answers with the new element and its box, and the agent edits it next", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const add = await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 0, slide: "256", box: { x: 5, y: 6, cx: 700, cy: 80 } },
      })
      expect(add.isError).not.toBe(true)
      expect(add.structuredContent).toEqual({
        ok: true,
        revision: 1,
        runId: "run",
        elements: [{ node: "256.5", value: "", version: 0, box: { x: 5, y: 6, cx: 700, cy: 80 } }],
      })
      const edit = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 1, changes: [{ node: "256.5", readAt: 0, value: "Later" }] },
      })
      expect(edit.isError).not.toBe(true)
      const read = readDeckPage(held.deck, { runId: "run", slide: "256" })
      expect(read.elements.find((element) => element.node === "256.5")).toMatchObject({ value: "Later" })
    })
  })

  it("writes the opening text in the same call, and reads it back", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const add = await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 0, slide: "256", text: "Hello" },
      })
      expect(add.structuredContent).toMatchObject({
        ok: true,
        runId: "run",
        elements: [{ node: "256.5", value: "Hello" }],
      })
      expect(
        readDeckPage(held.deck, { runId: "run", slide: "256" }).elements.find((e) => e.node === "256.5"),
      ).toMatchObject({
        value: "Hello",
      })
    })
  })

  it("names the slide and the reason when it cannot add", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const missing = await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 0, slide: "999" },
      })
      expect(missing.isError).toBe(true)
      expect(missing.structuredContent).toMatchObject({ ok: false, refusal: "dead" })
      expect(JSON.stringify(missing.content)).toContain("Slide 999: choose a present slide")
      const stale = await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 3, slide: "256" },
      })
      expect(stale.structuredContent).toMatchObject({ ok: false, refusal: "stale" })
    })
    expect(held.deck.revision).toBe(0)
  })

  it("leaves the deck as it was when the opening text is refused", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 0, slide: "256", text: "x".repeat(2_000_000) },
      })
      expect(refused.isError).toBe(true)
    })
    expect(held.deck.revision).toBe(0)
    expect(held.deck.register.order).toEqual([])
  })
})

describe("delete_element through MCP", () => {
  it("deletes an element, and says why it cannot delete a group, an animated element or a missing one", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const removed = await client.callTool({
        name: "airdesign_delete_element",
        arguments: { deck: "deck", base: 0, node: "256.2" },
      })
      expect(removed.structuredContent).toEqual({ ok: true, revision: 1, runId: "run", elements: [] })
      expect(elementGone(held.deck.register, elementId("256.2"))).toBe(true)
      for (const [node, refusal, words] of [
        ["256.3", "group-box", "Element 256.3 is inside a group"],
        ["256.4", "locked", "Element 256.4 has an animation"],
        ["256.2", "dead", "Element 256.2 was already deleted"],
        ["256.9", "dead", "Element 256.9: the deck has no such element"],
      ] as const) {
        const refused = await client.callTool({
          name: "airdesign_delete_element",
          arguments: { deck: "deck", base: held.deck.revision, node },
        })
        expect(refused.isError).toBe(true)
        expect(refused.structuredContent).toMatchObject({ ok: false, refusal })
        expect(JSON.stringify(refused.content)).toContain(words)
      }
    })
  })

  it("deletes a box the same run added and a person's Undo of the run takes both back", async () => {
    const held = session()
    await withClient(held, async (client) => {
      await client.callTool({
        name: "airdesign_add_text_box",
        arguments: { deck: "deck", base: 0, slide: "256", text: "A" },
      })
      await client.callTool({
        name: "airdesign_delete_element",
        arguments: { deck: "deck", base: held.deck.revision, node: "256.2" },
      })
    })
    const undone = call("undo_run", held.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(elementGone(undone.deck.register, elementId("256.5"))).toBe(true)
    expect(elementGone(undone.deck.register, elementId("256.2"))).toBe(false)
    const nodes = readDeckPage(undone.deck, { runId: null, slide: "256" }).elements.map((element) => element.node)
    expect(nodes).toEqual(["256.2", "256.3", "256.4"])
  })
})
