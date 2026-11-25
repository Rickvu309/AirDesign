import { onceMeta } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

const box = { x: 30, y: 100, w: 900, h: 600 }

it("refuses to shrink or add a linked chart below its minimum and names the minimum", async () => {
  const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] }).doom
  const before = start()
  const frame = doom.nodeId("chart:1")
  const slide = [...before.nodes.values()].find(({ type }) => type === "slide")!
  const writes = doom.placeComponent(before, doom.componentLibrary.get("column")!, {
    frame,
    parent: { id: slide.id, at: doom.orderKeyBetween(null, null) },
    box: { ...box, rotation: 0, flipH: false, flipV: false },
    data: { rows: [{ id: "a", label: "A", value: 3 }] },
    measure: doom.measureWith({}),
  })
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const placed = doom.applyEdit(before, {
    once: "place",
    author: { kind: "person", id: "test" },
    readBase: before.rev,
    rev: doom.rev(before.rev + 1),
    writes,
  })
  if (doom.isRefusal(placed)) throw new Error(JSON.stringify(placed))
  const deck = "dminimum"
  const decks = memoryDecks(start, new Map([[deck, placed]]))
  const host = { ...decks, measure: async () => ({ measure: doom.measureWith({}), missing: new Map() }) }
  const server = createServer({ agent: "aira", mint: () => "minted", log: emptyLog(), now: 0 }, host)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const { w, h } = doom.columnDefinition.spec.minFrame!
  try {
    for (const [index, change] of [
      { op: "set", target: frame, box: { ...box, h: 120 } },
      { op: "add", kind: "component", slide: slide.id, component: "column", box: { ...box, w: 100 } },
    ].entries()) {
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        _meta: { [onceMeta]: `small-${index}` },
        arguments: { deck, base: placed.rev, changes: [change] },
      })
      expect(result.structuredContent).toMatchObject({
        ok: false,
        note: expect.stringContaining(`Needs a size of at least ${w} × ${h} px.`),
      })
    }
    expect([...decks.decks.values()][0]).toBe(placed)
  } finally {
    await client.close()
    await server.close()
  }
})
