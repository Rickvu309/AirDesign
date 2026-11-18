import { readDeckId } from "@airdesign/catalog"
import { elementId, landedPatch, writeTextValue } from "@airdesign/document"
import { indexDeck, liveRuns, openDeck, readDeckPage, call } from "@airdesign/engine"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { expect, it } from "vitest"
import { createServer, emptyLog, memoryTurns, type Session } from "./index.js"

function session(): Session {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error("deck")
  const title = {
    node: elementId("256.2"),
    kind: "shape",
    value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
    box: null,
    grouped: false,
  } as const
  const indexed = indexDeck(
    openDeck(id.deck),
    { actor: "person" },
    {
      deck: "deck",
      once: "index",
      offset: 0,
      total: 1,
      slides: [{ id: "256", position: 0, layout: [title] }],
      elements: [title],
    },
  )
  if (!indexed.ok) throw new Error(indexed.refusal)
  return { deck: indexed.deck, caller: { actor: "agent", runId: "run" }, now: 0, turns: memoryTurns(), log: emptyLog() }
}
it("adds, reads, titles, duplicates, moves and deletes through MCP with the same run", async () => {
  const held = session()
  expect(readDeckPage(held.deck, { runId: null }).slides).toEqual([{ id: "256", position: 0 }])
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const add = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes: [{ op: "add_slide", after: "256", layout: "256" }] },
    })
    expect(add.isError).not.toBe(true)
    expect(add.structuredContent).toMatchObject({ slides: ["257"], runId: "run" })
    expect(readDeckPage(held.deck, { runId: "run", slide: "257" }).elements[0]?.node).toBe("257.2")
    const title = writeTextValue([{ from: 0, runs: [{ from: 0, text: "New title" }] }])
    expect(
      (
        await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: 1, changes: [{ node: "257.2", readAt: 0, value: title }] },
        })
      ).isError,
    ).not.toBe(true)
    expect(
      (
        await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: held.deck.revision, changes: [{ op: "duplicate_slide", slide: "257" }] },
        })
      ).structuredContent,
    ).toMatchObject({ slides: ["258"], runId: "run" })
    expect(readDeckPage(held.deck, { runId: "run", slide: "258" }).elements[0]?.value).toBe(title)
    for (const [name, input] of [
      ["move_slide", { slide: "258", after: null }],
      ["delete_slide", { slide: "256" }],
    ] as const) {
      expect(
        (
          await client.callTool({
            name: "airdesign_edit_deck",
            arguments: { deck: "deck", base: held.deck.revision, changes: [{ op: name, ...input }] },
          })
        ).isError,
      ).not.toBe(true)
    }
    expect(
      (await client.callTool({ name: "airdesign_stop_run", arguments: { deck: "deck", runId: "run" } })).isError,
    ).not.toBe(true)
  } finally {
    await client.close()
    await server.close()
  }
})
it("refuses stale, forged, missing slides and deletion of the last slide atomically", () => {
  const held = session()
  for (const [op, input, refusal] of [
    ["add_slide", { after: "256", layout: "256", base: 1 }, "stale"],
    ["delete_slide", { slide: "256" }, "dead"],
    ["duplicate_slide", { slide: "999" }, "dead"],
    ["move_slide", { slide: "256", after: "256" }, "dead"],
    ["add_slide", { after: "256", layout: "256", actor: "person" }, "field"],
  ] as const) {
    expect(
      call("edit_deck", held.deck, held.caller, {
        deck: "deck",
        base: "base" in input ? input.base : 0,
        changes: [{ op, ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== "base")) }],
      }),
    ).toEqual({ ok: false, refusal })
  }
})
it("lands a slide call on a fresh base while an earlier run is still live, and stops that run", async () => {
  const held = session()
  const started = call(
    "start_run",
    held.deck,
    { actor: "agent", runId: "old" },
    {
      deck: "deck",
      runId: "old",
      elements: [{ node: elementId("256.2") }],
    },
  )
  if (!started.ok) throw new Error(started.refusal)
  held.deck = started.deck
  held.turns.write(held.deck.id, { runId: "old", lastCall: -600_000, revision: held.deck.revision })
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const seen = held.deck.revision
    const stale = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: seen - 1, changes: [{ op: "add_slide", after: "256", layout: "256" }] },
    })
    expect(stale.structuredContent).toMatchObject({ ok: false, refusal: "stale" })
    expect(held.deck).toBe(started.deck)
    const add = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: seen, changes: [{ op: "add_slide", after: "256", layout: "256" }] },
    })
    expect(add.structuredContent).toMatchObject({ ok: true, slides: ["257"], runId: "run" })
    expect(liveRuns(held.deck)).toEqual([])
  } finally {
    await client.close()
    await server.close()
  }
})
it("fills a slide's background through edit_deck's set with a slide target, and no longer offers airdesign_set_background", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const listed = await client.listTools()
    expect(listed.tools.map((tool) => tool.name)).not.toContain("airdesign_set_background")
    const set = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes: [{ op: "set", target: "256", fill: { value: "accent1" } }] },
    })
    expect(set.isError).not.toBe(true)
    expect(set.structuredContent).toMatchObject({ ok: true, revision: 1, runId: "run" })
    const body = held.deck.register.elements[elementId("256.slide")]
    expect(body === undefined ? undefined : landedPatch(body, "text").fill).toEqual({
      value: { set: { solid: { scheme: "accent1" } } },
    })
    const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
    expect(read.structuredContent).toMatchObject({
      elements: [{ node: "256.2" }, { node: "256.slide", kind: "slide", value: null, design: "fill accent1" }],
    })
    const old = await client
      .callTool({
        name: "airdesign_set_background",
        arguments: { deck: "deck", base: 1, slide: "256", color: { scheme: "accent1" } },
      })
      .then(
        (result) => JSON.stringify(result),
        (error: unknown) => String(error),
      )
    expect(old).toContain("Tool airdesign_set_background not found")
    expect(held.deck.revision).toBe(1)
  } finally {
    await client.close()
    await server.close()
  }
})

it("lands mixed slide and element changes in one revision or none", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const before = held.deck
    const changes = [
      { op: "add_slide", after: "256", layout: "256" },
      { op: "delete", node: "999.2" },
    ]
    const refused = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: { deck: "deck", base: 0, changes },
    })
    expect(refused.isError).toBe(true)
    expect(held.deck).toEqual(before)
    const result = await client.callTool({
      name: "airdesign_edit_deck",
      arguments: {
        deck: "deck",
        base: 0,
        changes: [changes[0], { op: "move_slide", slide: "257", after: null }, { op: "delete", node: "256.2" }],
      },
    })
    expect(result.structuredContent).toMatchObject({ ok: true, revision: 1, slides: ["257"] })
    expect(readDeckPage(held.deck, { runId: "run" }).slides.map((slide) => slide.id)).toEqual(["257", "256"])
    expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
      "airdesign_edit_deck",
      "airdesign_list_decks",
      "airdesign_read_deck",
      "airdesign_stop_run",
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

it("lists and applies plural slide edits through the same tool and returns the copies' ids and content", async () => {
  const held = session()
  const server = createServer(held)
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "test", version: "1" })
  await server.connect(b)
  await client.connect(a)
  try {
    const listed = await client.listTools()
    const edit = listed.tools.find((tool) => tool.name === "airdesign_edit_deck")
    expect(JSON.stringify(edit?.inputSchema)).toContain("duplicate_slides")
    expect(JSON.stringify(edit?.inputSchema)).toContain("delete_slides")
    const change = async (edit: object) =>
      client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: held.deck.revision, changes: [edit] },
      })
    expect((await change({ op: "add_slide", after: "256", layout: "256" })).isError).not.toBe(true)
    const copied = await change({ op: "duplicate_slides", slides: ["257", "256"] })
    expect(copied.structuredContent).toMatchObject({ slides: ["258", "259"] })
    expect(held.deck.revision).toBe(2)
    expect(readDeckPage(held.deck, { runId: "run", slide: "258" }).elements[0]?.value).toBe(
      readDeckPage(held.deck, { runId: "run", slide: "256" }).elements[0]?.value,
    )
    expect((await change({ op: "delete_slides", slides: ["256", "257"] })).isError).not.toBe(true)
    expect(held.deck.revision).toBe(3)
    expect(readDeckPage(held.deck, { runId: "run" }).slides.map(({ id }) => id)).toEqual(["258", "259"])
  } finally {
    await client.close()
    await server.close()
  }
})
