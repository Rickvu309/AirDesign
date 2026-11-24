import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
}

function sessionFor(): Session {
  return { agent: "aira", mint: () => "minted", log: emptyLog(), now: 0 }
}

async function withClient(session: Session, host: Host, use: (client: Client) => Promise<void>): Promise<void> {
  const server = createServer(session, host)
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

describe("an axis unit over the protocol", () => {
  it("stores the unit, reads it back, and names a blank one", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<
          string,
          unknown
        >
      const made = await call("create_deck", { name: "Axis" })
      const deck = made.deck as string
      const slide = (made.slides as string[])[0]
      const edited = await call("edit_deck", {
        deck,
        base: made.rev,
        changes: [
          {
            op: "add",
            kind: "chart",
            slide,
            chart: {
              kind: "column",
              categories: ["Prior", "This"],
              series: [{ name: "Revenue", values: [43, 48.2] }],
              labels: true,
              unit: "$M",
            },
          },
        ],
      })
      expect(edited.ok).toBe(true)
      const read = await call("read_deck", { deck })
      expect(read.layers).toContain('"unit":"$M"')
      const bad = await call("edit_deck", {
        deck,
        base: read.rev,
        changes: [
          {
            op: "set",
            target: slide,
            chart: {
              kind: "column",
              categories: ["Prior", "This"],
              series: [{ name: "Revenue", values: [43, 48.2] }],
              unit: "   ",
            },
          },
        ],
      })
      expect(bad).toMatchObject({ ok: false, field: "unit" })
      expect((await call("read_deck", { deck })).rev).toBe(read.rev)
    })
  })
})
