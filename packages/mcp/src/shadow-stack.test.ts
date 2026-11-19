import { readDeckId } from "@airdesign/catalog"
import { elementId, format, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const node = elementId("258.7")

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function nodeBody(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
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

it("lands two shadows of each kind in one set and reads the changed stack back", async () => {
  const deck = opened()
  const index = {
    format,
    total: 1,
    slides: [{ id: "258", position: 0 }],
    elements: [{ node, kind: "shape", value: null, box: null, grouped: false }],
    pages: [],
  } as const
  const session = sessionFor({ ...deck, register: { ...deck.register, index } })
  await withClient(session, async (client) => {
    const offset = { blur: 4, distance: 3, direction: 45, color: "accent1" }
    const edited = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [
          {
            op: "set",
            target: node,
            effects: {
              shadow: { outer: offset },
              drop1: { outer: offset },
              innerShadow: { inner: offset },
              inner1: { inner: offset },
            },
          },
        ],
      },
    })
    expect(edited.isError, JSON.stringify(edited.content)).not.toBe(true)
    expect(edited.structuredContent).toMatchObject({ revision: 1 })
    expect(nodeBody(session.deck.register).landed).toHaveLength(1)
    const read = () => client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck", slide: "258" } })
    const first = await read()
    const details = "blur 4 distance 3 direction 45 accent1"
    expect(first.structuredContent).toMatchObject({
      elements: expect.arrayContaining([
        expect.objectContaining({
          node,
          design: ["shadow", "drop1", "innerShadow", "inner1"].map((slot) => `effects.${slot} ${details}`).join(" · "),
        }),
      ]),
    })
    const updated = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 1,
        changes: [{ op: "set", target: node, effects: { drop1: "none", inner1: { inner: { ...offset, blur: 8 } } } }],
      },
    })
    expect(updated.isError).not.toBe(true)
    const second = await read()
    expect(second.structuredContent).toMatchObject({
      elements: expect.arrayContaining([
        expect.objectContaining({
          node,
          design: `effects.shadow ${details} · effects.innerShadow ${details} · effects.inner1 blur 8 distance 3 direction 45 accent1`,
        }),
      ]),
    })
  })
})
