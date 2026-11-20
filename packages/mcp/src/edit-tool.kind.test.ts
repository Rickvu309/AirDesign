import { readDeckId } from "@airdesign/catalog"
import { elementGone, elementId, landedPatch, writeTextValue, type IndexElement, type Kind } from "@airdesign/document"
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
  ["256.4", "shape", null],
  ["256.5", "chart", null],
  ["256.6", "table", null],
  ["256.7", "group", null],
  ["256.8", "kept", null],
  ["256.9", "connector", null],
]

const insideGroup: readonly IndexElement[] = [
  { node: elementId("256.10"), kind: "shape", value: title, box, grouped: true, group: elementId("256.7") },
  { node: elementId("256.11"), kind: "shape", value: null, box, grouped: true, group: elementId("256.7") },
]

function session(inside: readonly IndexElement[] = []): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const listed = rows.map(([node, kind, value]): IndexElement => ({
    node: elementId(node),
    kind,
    value,
    box,
    grouped: false,
  }))
  const elements = [...listed, ...inside]
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: elements.length,
      slides: [{ id: "256", position: 0, size, free: 12, animated: [], layout: [] }],
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
        ["256.3", "a shape that holds no text", "airdesign_edit_deck with op add and kind shape"],
        ["256.4", "a shape that holds no text", "airdesign_edit_deck with op add and kind shape"],
        ["256.5", "a chart", "Tell the person"],
        ["256.6", "a table", "Set its cells with table's value"],
        ["256.7", "a group", "grouped"],
        ["256.8", "kept exactly as the file has it", "Leave it"],
        ["256.9", "a line", "airdesign_edit_deck with op add and kind shape"],
      ] as const) {
        const refused = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: 0, changes: [{ node, readAt: 0, value: text }] },
        })
        expect(refused.isError, node).toBe(true)
        expect(refused.structuredContent, node).toMatchObject({ ok: false, refusal: "kind" })
        const words = said(refused)
        expect(words, node).toContain(`Layer ${node} is ${kind}`)
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

  it("deletes a group with the layers inside it, as a person's Delete does", async () => {
    const held = session(insideGroup)
    await withClient(held, async (client) => {
      const removed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ op: "delete", node: "256.7" }] },
      })
      expect(removed.structuredContent).toMatchObject({ ok: true })
      for (const node of ["256.7", "256.10", "256.11"])
        expect(elementGone(held.deck.register, elementId(node))).toBe(true)
      const inside = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: held.deck.revision, changes: [{ op: "delete", node: "256.10" }] },
      })
      expect(said(inside)).toContain("Layer 256.10 was already deleted")
      const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
      const listed = JSON.stringify(read.structuredContent)
      for (const node of ["256.7", "256.10", "256.11"]) expect(listed).not.toContain(`"${node}"`)
      expect(listed).toContain('"256.2"')
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
      expect(words).toContain("Change 1 (256.7): Layer 256.7 is a group.")
      expect(words).toContain("Change 2 (256.6): Layer 256.6 is a table.")
      expect(words).toContain("Change 3 (256.5): Layer 256.5 is a chart.")
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
    expect(line === undefined ? undefined : landedPatch(line, "text")).toEqual({ border: { alpha: { set: 60_000 } } })
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
