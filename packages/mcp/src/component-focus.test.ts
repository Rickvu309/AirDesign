import { onceMeta } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

it("sets and clears category focus on a linked component over MCP", async () => {
  const start = () => doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ children: [] }] }).doom
  const before = start()
  const frame = doom.nodeId("chart:1")
  const slide = [...before.nodes.values()].find(({ type }) => type === "slide")!
  const writes = doom.placeComponent(before, doom.componentLibrary.get("column")!, {
    frame,
    parent: { id: slide.id, at: doom.orderKeyBetween(null, null) },
    box: { x: 30, y: 100, w: 900, h: 600, rotation: 0, flipH: false, flipV: false },
    data: {
      rows: [
        { id: "a", label: "A", value: 3 },
        { id: "b", label: "B", value: 2 },
      ],
    },
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
  const deck = "dfocus"
  const decks = memoryDecks(start, new Map([[deck, placed]]))
  const host = { ...decks, measure: async () => ({ measure: doom.measureWith({}), missing: new Map() }) }
  const server = createServer({ agent: "aira", mint: () => "minted", log: emptyLog(), now: 0 }, host)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    for (const [index, focus] of [["a"], [], ["unknown"]].entries()) {
      const name = focus.length ? "Focused chart" : "Column chart"
      const current = [...decks.decks.values()][0]!
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        _meta: { [onceMeta]: `focus-${index}` },
        arguments: {
          deck,
          base: current.rev,
          changes: [{ op: "set", target: frame, focus: index === 0 ? ["a", "a"] : focus, name }],
        },
      })
      expect(result.structuredContent).toMatchObject({ ok: true })
      const saved = [...decks.decks.values()][0]!
      expect(doom.propOf(saved.nodes.get(frame), "name")).toBe(name)
      const chart = doom.propOf(saved.nodes.get(frame), "instance")
      expect(chart?.focus).toEqual(focus)
      const bar = chart?.parts.find(({ key }) => key[0] === "bar" && key[1] === "b")?.node
      expect(bar && doom.propOf(saved.nodes.get(bar), "fills")).toEqual([
        { kind: "solid", color: index === 0 ? { var: "text2", tint: expect.any(Number) } : { var: "accent1" } },
      ])
      const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck, detail: frame } })
      expect(read.structuredContent).toMatchObject({ ok: true, layers: expect.stringContaining(frame) })
      expect(read.structuredContent).not.toHaveProperty("instance")
    }
  } finally {
    await client.close()
    await server.close()
  }
})
