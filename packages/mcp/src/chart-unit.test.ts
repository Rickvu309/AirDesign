import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"

import { createServer, emptyLog, type Host, type Session } from "./index.js"
import { memoryDecks } from "./testing/memory-decks.js"

function started(): doom.Doom {
  return doom.doomFromTree({ theme: doom.defaultTheme, slides: [{ name: "Title", children: [] }] }).doom
}

function sessionFor(): Session {
  let minted = 0
  return { agent: "aira", mint: () => `chart-unit-${++minted}`, log: emptyLog(), now: 0 }
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
  it("stores, fits and clears units, and names a non-text unit", async () => {
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
      const target = (edited.added as { id: string }[])[0]?.id
      const set = async (rev: unknown, unit: unknown) =>
        call("edit_deck", {
          deck,
          base: rev,
          changes: [
            {
              op: "set",
              target,
              chart: {
                kind: "column",
                categories: ["Prior", "This"],
                series: [{ name: "Revenue", values: [43, 48.2] }],
                unit,
              },
            },
          ],
        })
      let rev = read.rev
      for (const [raw, to] of [
        ["€".repeat(9), "€".repeat(8)],
        ["😀".repeat(12), "😀".repeat(6)],
        [`${"x".repeat(23)}😀`, "x".repeat(23)],
      ] as const) {
        const fitted = await set(rev, raw)
        expect.soft(fitted).toMatchObject({
          ok: true,
          findings: [{ code: "chart-unit-fit", node: target, to, note: expect.stringContaining(to) }],
        })
        const saved = await call("read_deck", { deck })
        expect.soft(saved.layers).toContain(`"unit":${JSON.stringify(to)}`)
        rev = saved.rev
      }
      const fitted = await set(rev, "USD\tper\r\nshare")
      expect(fitted).toMatchObject({
        ok: true,
        findings: [
          { code: "chart-unit-fit", node: target, to: "USD per share", note: expect.stringContaining("USD per share") },
        ],
      })
      expect((await call("read_deck", { deck })).layers).toContain('"unit":"USD per share"')
      const same = await set(fitted.rev, "USD\tper\r\nshare")
      expect(same).toMatchObject({
        ok: true,
        unchanged: true,
        findings: [{ code: "chart-unit-fit", to: "USD per share" }],
      })
      const family = "👨‍👩‍👧‍👦".repeat(2)
      const nothing = await set(fitted.rev, family)
      expect(nothing).toMatchObject({
        ok: true,
        findings: [
          {
            code: "chart-unit-fit",
            to: null,
            note: expect.stringContaining(`${JSON.stringify(family)} did not fit 24 bytes, so none is stored.`),
          },
        ],
      })
      const bell = await set(nothing.rev, "\u0007")
      expect(bell).toMatchObject({ ok: true, findings: [{ code: "chart-unit-fit", to: null }] })
      const said = (bell.findings as { note: string }[])[0]!.note
      expect(said).toContain("no printable character")
      expect(said).not.toContain("bytes")
      const cleared = await set(bell.rev, "")
      expect(cleared.ok).toBe(true)
      expect((await call("read_deck", { deck })).layers).not.toContain('"unit":')
      const bad = await set(cleared.rev, 4)
      expect(bad).toMatchObject({ ok: false, field: "chart.unit" })
      expect((await call("read_deck", { deck })).rev).toBe(cleared.rev)
    })
  })
})
