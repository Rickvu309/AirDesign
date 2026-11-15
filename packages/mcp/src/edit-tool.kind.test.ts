import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, writeTextValue, type Kind } from "@airdesign/document"
import { indexDeck, openDeck } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { describe, expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const size = { width: 12_192_000, height: 6_858_000 }
const box = { x: 1_524_000, y: 1_122_363, cx: 9_144_000, cy: 2_387_600 }
const title = writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }])

const rows: readonly (readonly [string, Kind, string | null])[] = [
  ["256.2", "shape", title],
  ["256.3", "shape", null],
  ["256.4", "picture", null],
  ["256.5", "chart", null],
  ["256.6", "table", null],
  ["256.7", "group", null],
  ["256.8", "kept", null],
  ["256.9", "connector", null],
]

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const elements = rows.map(([node, kind, value]) => ({ node: elementId(node), kind, value, box, grouped: false }))
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: elements.length,
      slides: [{ id: "256", position: 0, size, free: 10, animated: [], layout: [] }],
      elements,
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}

async function withClient(held: Session, use: (client: Client) => Promise<void>) {
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    await use(client)
  } finally {
    await client.close()
    await server.close()
  }
}

const text = writeTextValue([{ from: 0, runs: [{ from: -1, text: "Agent" }] }])

function said(result: Awaited<ReturnType<Client["callTool"]>>): string {
  return (result.content as readonly { readonly text?: string }[]).map((block) => block.text ?? "").join("\n")
}

describe("edit_deck refuses an edit the element's kind cannot take, and says what it can take", () => {
  it("refuses text on each element that holds none, names it, its kind and the next call, and lands nothing", async () => {
    const held = session()
    await withClient(held, async (client) => {
      for (const [node, kind, next] of [
        ["256.3", "a shape that holds no text", "airdesign_add_text_box"],
        ["256.4", "a picture", "airdesign_add_text_box"],
        ["256.5", "a chart", "Tell the person"],
        ["256.6", "a table", "Set its cells with table's value"],
        ["256.7", "a group", "grouped"],
        ["256.8", "kept exactly as the file has it", "Leave it"],
        ["256.9", "a line", "airdesign_add_text_box"],
      ] as const) {
        const refused = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: 0, changes: [{ node, readAt: 0, value: text }] },
        })
        expect(refused.isError, node).toBe(true)
        expect(refused.structuredContent, node).toMatchObject({ ok: false, refusal: "kind" })
        const words = said(refused)
        expect(words, node).toContain(`Element ${node} is ${kind}`)
        expect(words, node).toContain(next)
        expect(words, node).toContain("It takes")
        expect(words, node).not.toMatch(/\bTo put words beside it with\b/)
      }
    })
    expect(held.deck.revision).toBe(0)
    expect(held.deck.register.nodes.every((node) => held.deck.register.elements[node]?.phase !== "running")).toBe(true)
  })

  it("names every change that needs fixing at once, and lands none of them", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: [
            { node: "256.2", readAt: 0, value: text },
            { node: "256.4", readAt: 0, value: text },
            { node: "256.8", readAt: 0, property: "box", value: { ...box, cx: 1 } },
          ],
        },
      })
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "kind" })
      const words = said(refused)
      expect(words).toContain("Change 2 (256.4)")
      expect(words).toContain("Change 3 (256.8)")
      expect(words).not.toContain("Change 1")
    })
    expect(held.deck.register.elements[elementId("256.2")]).toBeUndefined()
  })

  it("says a group cannot be deleted without telling the agent to edit text it does not have", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_delete_element",
        arguments: { deck: "deck", base: 0, node: "256.7" },
      })
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "group-box" })
      const words = said(refused)
      expect(words).toContain("Element 256.7 is a group, and deleting a group is not supported yet. Leave it")
      expect(words).not.toContain("Element 256.7 is inside a group")
    })
  })

  it("refuses opacity on a group, a table and a chart, which take no alpha, and lands it on a line and a picture", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: ["256.7", "256.6", "256.5", "256.9"].map((target) => ({ op: "set", target, opacity: 60 })),
        },
      })
      expect(refused.structuredContent).toMatchObject({ ok: false, refusal: "kind" })
      const words = said(refused)
      expect(words).toContain("Change 1 (256.7): Element 256.7 is a group.")
      expect(words).toContain("Change 2 (256.6): Element 256.6 is a table.")
      expect(words).toContain("Change 3 (256.5): Element 256.5 is a chart.")
      expect(words).not.toContain("Change 4")
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: ["256.9", "256.4"].map((target) => ({ op: "set", target, opacity: 60 })),
        },
      })
      expect(landed.isError).toBeFalsy()
    })
    const line = held.deck.register.elements[elementId("256.9")]
    expect(line === undefined ? undefined : landedPatch(line, "text")).toEqual({ line: { alpha: { set: 60_000 } } })
  })

  it("lands what each kind can take: a move of a table, a picture or a chart", async () => {
    const held = session()
    await withClient(held, async (client) => {
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 0,
          changes: ["256.4", "256.5", "256.6"].map((node) => ({
            node,
            readAt: 0,
            property: "box",
            value: { ...box, x: 0 },
          })),
        },
      })
      expect(landed.isError).toBeFalsy()
    })
  })
})
