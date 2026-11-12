import { readDeckId } from "@airdesign/catalog"
import { elementId, writeTextValue } from "@airdesign/document"
import { indexDeck, openDeck, readDeckPage, call } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = {
    node: elementId("256.2"),
    kind: "shape",
    value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
    box: null,
    grouped: false,
  } as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [title] }],
      elements: [title],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}
it("adds, reads, titles, duplicates, moves and deletes through MCP with the same run", async () => {
  const held = session()
  expect(readDeckPage(held.deck, { runId: null }).slides).toEqual([{ id: "256", position: 0 }])
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const add = await client.callTool({
      name: "airdesign_add_slide",
      arguments: { deck: "deck", base: 0, after: "256", layout: "256" },
    })
    expect(add.isError).not.toBe(true)
    expect(add.structuredContent).toMatchObject({ slide: "257", runId: "run" })
    expect(readDeckPage(held.deck, { runId: "run", slide: "257" }).elements[0]?.node).toBe("257.2")
    const title = writeTextValue([{ from: 0, runs: [{ from: 0, text: "New title" }] }])
    expect(
      (
        await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: 1, changes: [{ node: "257.2", readAt: 0, value: title }] },
        })
      ).isError,
    ).not.toBe(true)
    expect(
      (
        await client.callTool({
          name: "airdesign_duplicate_slide",
          arguments: { deck: "deck", base: held.deck.revision, slide: "257" },
        })
      ).structuredContent,
    ).toMatchObject({ slide: "258", runId: "run" })
    expect(readDeckPage(held.deck, { runId: "run", slide: "258" }).elements[0]?.value).toBe(title)
    for (const [name, input] of [
      ["move_slide", { slide: "258", after: null }],
      ["delete_slide", { slide: "256" }],
    ] as const) {
      expect(
        (
          await client.callTool({
            name: `airdesign_${name}`,
            arguments: { deck: "deck", base: held.deck.revision, ...input },
          })
        ).isError,
      ).not.toBe(true)
    }
    expect(
      (await client.callTool({ name: "airdesign_stop_run", arguments: { deck: "deck", runId: "run" } })).isError,
    ).not.toBe(true)
  } finally {
    await client.close()
    await server.close()
  }
})
it("refuses stale, forged, missing slides and deletion of the last slide atomically", () => {
  const held = session()
  for (const [op, input, refusal] of [
    ["add_slide", { after: "256", layout: "256", base: 1 }, "stale"],
    ["delete_slide", { slide: "256" }, "dead"],
    ["duplicate_slide", { slide: "999" }, "dead"],
    ["move_slide", { slide: "256", after: "256" }, "dead"],
    ["add_slide", { after: "256", layout: "256", actor: "person" }, "field"],
  ] as const) {
    expect(call(op, held.deck, held.caller, { deck: "deck", base: 0, ...input })).toEqual({ ok: false, refusal })
  }
})
