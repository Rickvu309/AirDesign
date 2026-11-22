import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, templateStylesNode } from "@airdesign/document"
import { call, indexDeck, openDeck, readDeckPage } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

const red = "C00000"
const palette = { slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" }, map: { tx1: "dk1", bg1: "lt1" } }

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = { node: elementId("256.2"), kind: "shape", value: "Title", box: null, grouped: false } as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      format: 2,
      once: "index",
      offset: 0,
      total: 1,
      palettes: [palette],
      slides: [{ id: "256", position: 0 }],
      elements: [title],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}

it("lets an agent change every template style's colours and fonts with set, by today's names or the old ones, read them back, and lose them to run Undo", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const onShape = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [{ op: "set", target: "256.2", templateStyle: { accent1: `#${red}` } }],
      },
    })
    expect(onShape.isError).toBe(true)
    expect(JSON.stringify(onShape.content)).toContain("Send templateStyle with target deck.templateStyles.")
    const templateStyle = { accent1: `#${red.toLowerCase()}` }
    const set = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "deck.templateStyles", templateStyle }] },
    })
    expect(set.isError).not.toBe(true)
    const old = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 1, changes: [{ op: "set", target: "deck.theme", theme: { major: "Georgia" } }] },
    })
    expect(old.isError).not.toBe(true)
    expect(old.structuredContent).toMatchObject({ ok: true, elements: [{ node: "deck.templateStyles" }] })
    const body = held.deck.register.elements[templateStylesNode]
    expect(body === undefined ? undefined : landedPatch(body, "text").templateStyle).toEqual({
      accent1: { set: "C00000" },
      major: { set: "Georgia" },
    })
    const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
    expect(read.structuredContent).toMatchObject({
      palettes: [{ slots: { accent1: "C00000" } }],
      templateStyle: { accent1: `#${red}`, major: "Georgia" },
      elements: [{ node: "256.2" }],
    })
    const undone = call("undo_run", held.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    if (!undone.ok) throw new Error(undone.refusal)
    const after = readDeckPage(undone.deck, { runId: null })
    expect(after.palettes).toEqual([palette])
    expect(after).not.toHaveProperty("templateStyle")
  } finally {
    await client.close()
  }
})

it("applies a template through templateStyle.template, never reads it back, refuses unknown ids with valid ids, and undoes in one step", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const unknown = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "sunset" } }],
      },
    })
    expect(unknown.isError).toBe(true)
    expect(unknown.structuredContent).toMatchObject({ ok: false, refusal: "field" })
    const message = JSON.stringify(unknown.content)
    expect(message).toContain("neutral")
    expect(message).toContain("midnight")
    expect(message).toContain("editorial")
    const onShape = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [{ op: "set", target: "256.2", templateStyle: { template: "midnight" } }],
      },
    })
    expect(onShape.isError).toBe(true)
    expect(onShape.structuredContent).toMatchObject({ ok: false, refusal: "kind" })
    expect(JSON.stringify(onShape.content)).toContain("Send templateStyle with target deck.templateStyles.")
    const applied = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [{ op: "set", target: "deck.templateStyles", templateStyle: { template: "midnight" } }],
      },
    })
    expect(applied.isError).not.toBe(true)
    const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
    expect(read.structuredContent).toMatchObject({
      palettes: [
        {
          slots: {
            dk1: "F4F6FA",
            lt1: "0E1626",
            dk2: "9AA6BA",
            lt2: "1A2438",
            accent1: "6B9BFF",
          },
          fonts: { major: "Inter SemiBold", minor: "Inter" },
        },
      ],
    })
    expect(read.structuredContent).not.toHaveProperty("templateStyle.template")
    const undone = call("undo_run", held.deck, { actor: "person" }, { deck: "deck", runId: "run" })
    if (!undone.ok) throw new Error(undone.refusal)
    expect(readDeckPage(undone.deck, { runId: null }).palettes).toEqual([palette])
  } finally {
    await client.close()
  }
})
