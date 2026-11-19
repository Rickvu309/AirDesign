import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, type IndexElement } from "@airdesign/document"
import { indexDeck, openDeck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const teal = "1E9AA8"

const size = { width: 12_192_000, height: 6_858_000 }
const node = (shape: number) => elementId(`256.${shape}`)
const frameBox = { x: 1_000_000, y: 1_000_000, cx: 3_627_000, cy: 1_000_000 }

const elements: readonly IndexElement[] = [
  {
    node: node(2),
    kind: "group",
    value: null,
    box: frameBox,
    grouped: false,
    frame: frameBox,
    framing: {
      backdrop: node(3),
      children: [node(4), node(5)],
      layout: { flow: "horizontal", gap: 127_000, padding: [0, 0, 0, 0], align: "topLeft" },
    },
  },
  { node: node(3), kind: "shape", value: null, box: frameBox, grouped: true, group: node(2) },
  { node: node(4), kind: "shape", value: null, box: { ...frameBox, cx: 2_000_000 }, grouped: true, group: node(2) },
  {
    node: node(5),
    kind: "shape",
    value: null,
    box: { x: 3_127_000, y: 1_000_000, cx: 1_500_000, cy: 600_000 },
    grouped: true,
    group: node(2),
  },
]

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
      total: elements.length,
      slides: [{ id: "256", position: 0, size, free: 6, animated: [], layout: [] }],
      elements,
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}

it("lands a frame's layout on the frame and its fill on the backdrop of a frame read from a file", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const answer = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: held.deck.revision,
        changes: [{ op: "set", target: "256.2", layout: { flow: "vertical" }, fills: { paint: `#${teal}` } }],
      },
    })
    expect(answer.isError).not.toBe(true)
  } finally {
    await client.close()
    await server.close()
  }
  const register = held.deck.register
  const patch = (shape: number) => {
    const body = register.elements[node(shape)]
    return body === undefined ? {} : landedPatch(body, "text")
  }
  expect(patch(2).layout?.flow).toEqual({ set: "vertical" })
  expect(patch(3).fills?.p0).toEqual({ set: { solid: { rgb: teal } } })
})
