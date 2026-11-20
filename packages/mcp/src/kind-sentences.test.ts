import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { openDeck, type Deck } from "@airdesign/engine"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

async function withClient(session: Session, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

it("describes each element kind", async () => {
  await withClient(sessionFor(opened()), async (client) => {
    const instructions = client.getInstructions() ?? ""
    expect(instructions).toContain('"op": "set"')
    expect(instructions).toContain(
      "A shape takes identity (name, alt, hidden, locked, mask), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape, corners), fills (paint, source, weight, color, mode, tileScale, crop, recolor, overlay, blur), border (fill, width, dash, cap, compound, join, head, tail), effects (shadow, innerShadow, drop1, drop2, drop3, inner1, inner2, inner3, glow, softEdge, blur), body (insets, anchor, wrap, autofit, vertical, columns), text (value, fill, color, size, font",
    )
    expect(instructions).toContain(
      "letterSpacing, lineHeight, spaceBefore, style, spaceAfter), link (target) and opacity.",
    )
    expect(instructions).toContain(
      "A line takes identity (name, alt, hidden, locked), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape, corners), border (fill, width, dash",
    )
    expect(instructions).toContain("connection (start, end) and opacity.")
    expect(instructions).toContain('"opacity": 60')
    expect(instructions).toContain(
      "A table takes identity (name, alt, hidden, locked), box (x, y, w, h, align, distribute) and table (value).",
    )
    expect(instructions).toContain(
      "A group takes identity (name, alt, hidden, locked), box (x, y, w, h, rot, flipH, flipV, align, distribute) and effects (shadow, innerShadow, drop1, drop2, drop3, inner1, inner2, inner3, glow, softEdge, blur).",
    )
  })
})
