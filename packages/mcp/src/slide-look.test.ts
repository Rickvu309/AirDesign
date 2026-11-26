import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { scriptOf } from "./testing/change-script.js"
import { memoryDecks } from "./testing/memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Title",
        children: [
          { type: "shape", name: "Title", props: { role: "title", text: doom.textFromMarkdown("Untitled", "title") } },
        ],
      },
    ],
  }).doom
}

function sessionFor(): Session {
  let minted = 0
  return { agent: "aira", mint: () => `minted${String((minted += 1))}`, log: emptyLog(), now: 0 }
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

describe("skip, transition, word spacing and blur over the protocol", () => {
  it("writes them on the deck and reads the same words back, and names a bad field", async () => {
    await withClient(sessionFor(), memoryDecks(started), async (client) => {
      const call = async (name: string, args: Record<string, unknown>) =>
        (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent as Record<string, any>
      const made = await call("execute", { script: 'createDeck({ name: "Look" })' })
      const slide = (made.slides as string[])[0]!
      const edited = await call("execute", {
        deck: made.deck,
        script: scriptOf([
          { op: "set", target: slide, skipped: true, transition: { kind: "push", ms: 500 } },
          { op: "add", kind: "text", slide, text: "Hello", alignV: "bottom", spaceBefore: 12, spaceAfter: 8, blur: 6 },
        ]),
      })
      expect(edited).toMatchObject({ ok: true })
      const layers = (await call("execute", { deck: made.deck, script: "get().layers" })).result as string
      expect(layers).toContain("skipped")
      expect(layers).toContain("transition=push/500")
      expect(layers).toContain("alignV=bottom")
      expect(layers).toContain("spaceBefore=12")
      expect(layers).toContain("spaceAfter=8")
      expect(layers).toContain("blur=6")
      const bad = await call("execute", {
        deck: made.deck,
        script: scriptOf([{ op: "set", target: slide, alignV: "middle" }]),
      })
      expect(bad).toMatchObject({ ok: false, field: "alignV" })
    })
  })
})
