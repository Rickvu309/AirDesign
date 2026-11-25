import * as doom from "@airdesign/doom"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
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

describe("consulting slide advice over MCP", () => {
  it.each(["measured", "fonts", "fault", "without host measurement"] as const)(
    "returns slide advice in edit and read structured content (%s)",
    async (mode) => {
      let minted = 0
      const session = { ...sessionFor(), mint: () => `minted${++minted}` }
      const host: Host = {
        ...memoryDecks(started),
        ...(mode === "without host measurement"
          ? {}
          : {
              measure: async () => {
                if (mode === "fonts") return "fonts"
                if (mode === "fault") throw new Error("Measurement unavailable")
                return { measure: doom.measureWith({}), missing: new Map() }
              },
            }),
      }
      await withClient(session, host, async (client) => {
        const call = async (name: string, args: Record<string, unknown>) =>
          (await client.callTool({ name: `airdesign_${name}`, arguments: args })).structuredContent
        const made = await call("create_deck", {})
        if (
          typeof made !== "object" ||
          made === null ||
          !("deck" in made) ||
          typeof made.deck !== "string" ||
          !("rev" in made) ||
          typeof made.rev !== "number" ||
          !("slides" in made) ||
          !Array.isArray(made.slides) ||
          typeof made.slides[0] !== "string"
        )
          throw new Error("Missing deck revision or first slide")
        const {
          deck,
          rev,
          slides: [slide],
        } = made
        const edit = await call("edit_deck", {
          deck,
          base: rev,
          changes: [
            { op: "set", target: `${slide}.title`, text: "Pricing strategy" },
            {
              op: "add",
              kind: "chart",
              slide,
              chart: { kind: "column", categories: ["North"], series: [{ name: "Revenue", values: [14] }] },
              box: { x: 160, y: 360, w: 1500, h: 450 },
            },
          ],
        })
        for (const answer of [edit, await call("read_deck", { deck, slide })]) {
          expect(answer).toMatchObject({
            ok: true,
            findings: expect.arrayContaining([
              { code: "no-source", node: slide, slide, note: expect.any(String) },
              expect.objectContaining({ code: "title-label", slide }),
            ]),
          })
        }
      })
    },
  )
})
