import { catalog, projectTools, readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport, fromJsonSchema, type JsonSchemaType } from "@modelcontextprotocol/client"
import { decide, elementId, rootElement, version, type NodeRegister, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { createServer, editNext, emptyLog, memoryTurns, type CallerLog, type Session } from "./index.js"

function firstOf(register: Register): NodeRegister {
  const body = register.elements[rootElement]
  if (body === undefined) throw new Error("missing node")
  return body
}

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

const node = elementId("258.7")

function nodeBody(register: Register) {
  const body = register.elements[node]
  if (body === undefined) throw new Error("missing node")
  return body
}

function running(): Deck {
  const deck = opened()
  const added = decide(deck.register, {
    command: "add",
    node,
    floor: deck.register.floor,
    route: deck.register.route,
  })
  if (added.decision !== "apply") throw new Error(added.code)
  const started = decide(added.register, { command: "start", runId: "run", node })
  if (started.decision !== "apply") throw new Error(started.code)
  return { id: deck.id, revision: deck.revision, register: started.register }
}

function sessionFor(deck: Deck): Session {
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns: memoryTurns() }
}

function held(deck: Deck, holder: { log: CallerLog }): Session {
  return {
    caller: { actor: "agent", runId: "run" },
    deck,
    get log() {
      return holder.log
    },
    set log(value) {
      holder.log = value
    },
    now: 0,
    turns: memoryTurns(),
  }
}

function utf8Size(text: string): number {
  let size = 0
  for (const symbol of text) {
    const code = symbol.codePointAt(0) ?? 0
    if (code <= 0x7f) size += 1
    else if (code <= 0x7ff) size += 2
    else if (code <= 0xffff) size += 3
    else size += 4
  }
  return size
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

describe("createServer", () => {
  it("describes each element kind", async () => {
    await withClient(sessionFor(opened()), async (client) => {
      const instructions = client.getInstructions() ?? ""
      expect(instructions).toContain('"op": "set"')
      expect(instructions).toContain(
        "A shape takes identity (name, alt, hidden), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape), fill (value), line (fill, width, dash, cap, compound, join, head, tail), effects (shadow, glow, softEdge), body (insets, anchor, wrap, autofit, vertical, columns), text (value, fill, color, size, font",
      )
      expect(instructions).toContain("list, strike, letterSpacing, lineSpacing")
      expect(instructions).toContain(
        "A line takes identity (name, alt, hidden), box (x, y, w, h, rot, flipH, flipV, align, distribute), geometry (shape), line (fill, width, dash",
      )
      expect(instructions).toContain("connection (start, end) and opacity.")
      expect(instructions).toContain('"opacity": 60')
      expect(instructions).toContain(
        "A table takes identity (name, alt, hidden) and box (x, y, w, h, align, distribute).",
      )
      expect(instructions).toContain(
        "A group takes identity (name, alt, hidden), box (x, y, w, h, rot, flipH, flipV, align, distribute) and effects (shadow, glow, softEdge).",
      )
    })
  })

  it("returns a new server on every call", () => {
    const session = sessionFor(opened())
    expect(createServer(session)).not.toBe(createServer(session))
  })

  it("lists tools within budget", async () => {
    const projected = projectTools(catalog)
    await withClient(sessionFor(opened()), async (client) => {
      expect(client.getServerVersion()?.name).toBe("airdesign")
      const { tools } = await client.listTools()
      expect(tools.length).toBe(projected.length)
      expect(tools.length).toBeLessThanOrEqual(20)
      expect(tools.map((tool) => tool.name)).toEqual(projected.map((tool) => tool.name))
      for (const [index, tool] of tools.entries()) {
        const expected = projected[index]
        if (expected === undefined) throw new Error("missing tool")
        expect(tool.description).toBe(expected.description)
        expect(tool.annotations).toEqual({
          readOnlyHint: expected.readOnlyHint,
          destructiveHint: expected.destructiveHint,
          idempotentHint: expected.idempotentHint,
          openWorldHint: expected.openWorldHint,
        })
      }
      const edit = tools.find((tool) => tool.name === "airdesign_edit_deck")
      if (edit === undefined) throw new Error("missing edit")
      const schema = edit.inputSchema as {
        properties?: { changes?: { items?: { anyOf?: readonly { required?: readonly string[] }[] } } }
      }
      const changes = schema.properties?.changes?.items?.anyOf ?? []
      expect(changes.map((change) => change.required)).toEqual([
        expect.arrayContaining(["node", "readAt"]),
        expect.arrayContaining(["node", "readAt"]),
        ["op", "target"],
        ["op", "kind", "slide"],
        ["op", "elements"],
        ["op", "slide", "labels"],
        ["op"],
        ["op", "node"],
      ])
      const advertised = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }))
      const estimate = Math.ceil(utf8Size(JSON.stringify(advertised)) / 4)
      expect(estimate).toBeLessThanOrEqual(8000)
      const listed = await client.listTools()
      expect(Math.ceil(utf8Size(JSON.stringify(listed)) / 4)).toBeLessThanOrEqual(8000)
      expect(tools.every((tool) => !Object.hasOwn(tool, "outputSchema"))).toBe(true)
    })
  })

  it("refuses an actor on the wire and leaves the deck", async () => {
    const deck = running()
    await withClient(sessionFor(deck), async (client) => {
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }], actor: "person" },
      })
      expect(result.isError).toBe(true)
      const answer = { ok: false, revision: 0, refusal: "field", elements: [] }
      expect(result.content).toEqual([
        { type: "text", text: editNext.field },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(result.structuredContent).toEqual(answer)
      expect(deck.revision).toBe(0)
      expect(firstOf(deck.register).landed).toEqual([])
    })
  })

  it("advertises exactly what every tool reader accepts", async () => {
    const change = { value: "21", node: "258.7", readAt: 0 }
    const edit = { deck: "deck", base: 0, changes: [change] }
    const inputs: unknown[] = [
      null,
      [],
      "deck",
      7,
      {},
      { deck: "deck" },
      { deck: "bad id" },
      { deck: 7 },
      { deck: "deck", actor: "agent" },
      { deck: "deck", runId: "run" },
      { deck: "deck", runId: 7 },
      { deck: "deck", runId: "bad id" },
      { deck: "deck", runId: "run", extra: true },
      edit,
      { ...edit, extra: true },
      { ...edit, deck: 7 },
      { base: 0, changes: [change] },
      { ...edit, base: -1 },
      { ...edit, base: 0.5 },
      { ...edit, base: Number.MAX_SAFE_INTEGER + 1 },
      { ...edit, changes: "21" },
      { ...edit, changes: [] },
      { ...edit, changes: Array.from({ length: 101 }, () => change) },
      ...[
        { ...change, value: 7 },
        { ...change, value: "\u0000" },
        { ...change, value: "\ud800" },
        { ...change, value: "😀" },
        { ...change, floor: "old" },
        { ...change, floor: 7 },
        { ...change, actor: "person" },
        { ...change, node: "a" },
        { ...change, node: "258.7\n" },
        { ...change, readAt: -1 },
        { ...change, readAt: 0.5 },
      ].map((item) => ({ ...edit, changes: [item] })),
    ]
    await withClient(sessionFor(opened()), async (client) => {
      const { tools } = await client.listTools()
      for (const tool of projectTools(catalog)) {
        const advertised = tools.find((item) => item.name === tool.name)
        if (advertised === undefined) throw new Error("missing tool")
        const schema = fromJsonSchema(advertised.inputSchema as JsonSchemaType)
        for (const input of inputs) {
          const checked = await schema["~standard"].validate(input)
          expect(!checked.issues?.length, `${tool.name}: ${JSON.stringify(input)}`).toBe(
            catalog[tool.op].read(input).ok,
          )
        }
      }
    })
  })

  it("returns our sentences and structured refusals for SDK validation failures", async () => {
    const change = { value: "21", node: "258.7", readAt: 0 }
    for (const [name, arguments_, refusal] of [
      ["airdesign_edit_deck", { deck: "deck", base: 0, changes: [{ ...change, value: 7 }] }, "field"],
      ["airdesign_edit_deck", { deck: "deck", base: 0, changes: "21" }, "batch"],
      ["airdesign_edit_deck", { base: 0, changes: [change] }, "field"],
      ["airdesign_stop_run", { deck: "deck", runId: 7 }, "field"],
      ["airdesign_stop_run", { runId: "run" }, "field"],
    ] as const) {
      const session = sessionFor(opened())
      const before = session.deck
      await withClient(session, async (client) => {
        const result = await client.callTool({ name, arguments: arguments_ })
        const answer = { ok: false, revision: 0, refusal, elements: [] }
        expect(result.isError).toBe(true)
        expect(result.content).toEqual([
          { type: "text", text: editNext[refusal] },
          { type: "text", text: JSON.stringify(answer) },
        ])
        expect(result.structuredContent).toEqual(answer)
        expect(session.deck).toBe(before)
      })
    }
  })

  it("lands an edit on the wire", async () => {
    const before = running()
    const caller = { actor: "agent" as const, runId: "run" }
    const session: Session = { caller, deck: before, log: emptyLog(), now: 0, turns: memoryTurns() }
    await withClient(session, async (client) => {
      const first = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(first.isError).not.toBe(true)
      expect(session.deck).not.toBe(before)
      expect(session.deck.revision).toBe(1)
      expect(nodeBody(session.deck.register).landed).toEqual([
        { actor: "agent", value: "21", visible: true, runId: "run" },
      ])
      expect(before.revision).toBe(0)
      expect(nodeBody(before.register).landed).toEqual([])

      const second = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: 1,
          changes: [{ value: "22", node: "258.7", readAt: version(nodeBody(session.deck.register)) }],
        },
      })
      expect(second.isError).not.toBe(true)
      expect(session.deck.revision).toBe(2)
      expect(nodeBody(session.deck.register).landed.map((row) => row.value)).toEqual(["21", "22"])
      expect(before.revision).toBe(0)
    })
  })

  it("refuses the thirty-first tool call and leaves the deck", async () => {
    const deck = running()
    const session = sessionFor(deck)
    await withClient(session, async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
        expect(read.isError).toBeFalsy()
      }
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([
        { type: "text", text: "Thirty tool calls in five minutes. The next tool call can run in 300 seconds." },
      ])
      expect(session.deck).toBe(deck)
      expect(session.deck.revision).toBe(0)
      expect(firstOf(session.deck.register).landed).toEqual([])
      expect(session.log.events).toHaveLength(30)

      session.now = 300_000
      const landed = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(landed.isError).not.toBe(true)
      expect(session.deck).not.toBe(deck)
      expect(session.deck.revision).toBe(1)
      expect(nodeBody(session.deck.register).landed).toEqual([
        { actor: "agent", value: "21", visible: true, runId: "run" },
      ])
      expect(deck.revision).toBe(0)
      expect(session.log.events).toEqual([{ kind: "tool", at: 300_000 }])
    })
  })

  it("lands an edit on a deck that no test started a run on", async () => {
    const before = opened()
    expect(firstOf(before.register).phase).toBe("idle")
    const session = sessionFor(before)
    await withClient(session, async (client) => {
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(result.isError).not.toBe(true)
      const answer = { ok: true, revision: 1, runId: "run", elements: [{ node: "258.7", value: "21", version: 1 }] }
      expect(result.content).toEqual([
        { type: "text", text: "Landed revision 1." },
        { type: "text", text: JSON.stringify(answer) },
      ])
      expect(result.structuredContent).toEqual(answer)
      expect(session.deck.revision).toBe(1)
      const body = nodeBody(session.deck.register)
      expect(body.phase).toBe("running")
      expect(body.runId).toBe("run")
      expect(body.landed).toEqual([{ actor: "agent", value: "21", visible: true, runId: "run" }])
      expect(firstOf(before.register).phase).toBe("idle")
      expect(firstOf(before.register).landed).toEqual([])
    })
  })

  it("tells the agent the next step when an edit is stale", async () => {
    const before = opened()
    const session = sessionFor(before)
    await withClient(session, async (client) => {
      for (const [readAt, value] of [
        [0, "21"],
        [1, "22"],
      ] as const) {
        const landed = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base: readAt, changes: [{ value, node: "258.7", readAt }] },
        })
        expect(landed.isError).not.toBe(true)
      }
      const stale = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 2, changes: [{ value: "late", node: "258.7", readAt: 0 }] },
      })
      expect(stale.isError).toBe(true)
      const block = { ok: false, revision: 2, refusal: "stale", elements: [{ node: "258.7", value: "22", version: 2 }] }
      expect(stale.content).toEqual([
        { type: "text", text: editNext.stale },
        { type: "text", text: JSON.stringify(block) },
      ])
      expect(stale.structuredContent).toEqual(block)
      expect(session.deck.revision).toBe(2)
      expect(nodeBody(session.deck.register).landed.map((row) => row.value)).toEqual(["21", "22"])
      const sent = block.elements[0]
      if (sent === undefined) throw new Error("missing element")
      const resent = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: {
          deck: "deck",
          base: block.revision,
          changes: [{ value: "late", node: sent.node, readAt: sent.version }],
        },
      })
      expect(resent.isError).not.toBe(true)
      expect(resent.structuredContent).toEqual({
        ok: true,
        revision: 3,
        runId: "run",
        elements: [{ node: "258.7", value: "late", version: 3 }],
      })
      expect(session.deck.revision).toBe(3)
      expect(nodeBody(session.deck.register).landed.map((row) => row.value)).toEqual(["21", "22", "late"])
    })
  })

  it("lands two edits in a row, each at the version the previous answer carried", async () => {
    const session = sessionFor(opened())
    await withClient(session, async (client) => {
      let readAt = 0
      let base = 0
      for (const value of ["21", "22"]) {
        const result = await client.callTool({
          name: "airdesign_edit_deck",
          arguments: { deck: "deck", base, changes: [{ value, node: "258.7", readAt }] },
        })
        expect(result.isError).not.toBe(true)
        const answer = result.structuredContent as { revision: number; elements: { version: number }[] }
        expect(result.content.at(-1)).toEqual({ type: "text", text: JSON.stringify(answer) })
        readAt = answer.elements[0]?.version ?? -1
        base = answer.revision
      }
      expect(readAt).toBe(2)
      expect(session.deck.revision).toBe(2)
      expect(nodeBody(session.deck.register).landed.map((row) => row.value)).toEqual(["21", "22"])
    })
  })

  it("refuses the thirty-first tool call of one caller across two connections", async () => {
    const holder: { log: CallerLog } = { log: emptyLog() }
    const firstDeck = opened()
    const secondDeck = opened()
    const first = held(firstDeck, holder)
    const second = held(secondDeck, holder)
    await withClient(first, async (client) => {
      for (let call = 0; call < 20; call += 1) {
        const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
        expect(read.isError).toBeFalsy()
      }
    })
    await withClient(second, async (client) => {
      for (let call = 0; call < 10; call += 1) {
        const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
        expect(read.isError).toBeFalsy()
      }
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([
        { type: "text", text: "Thirty tool calls in five minutes. The next tool call can run in 300 seconds." },
      ])
      expect(second.deck).toBe(secondDeck)
      expect(firstOf(secondDeck.register).landed).toEqual([])
    })
    expect(holder.log.events).toHaveLength(30)
    expect(firstOf(firstDeck.register).landed).toEqual([])
  })

  it("says when the limit resets in seconds", async () => {
    const deck = running()
    const session = sessionFor(deck)
    await withClient(session, async (client) => {
      for (let call = 0; call < 30; call += 1) {
        const read = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
        expect(read.isError).toBeFalsy()
      }
      session.now = 298_501
      const refused = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }] },
      })
      expect(refused.isError).toBe(true)
      expect(refused.content).toEqual([
        { type: "text", text: "Thirty tool calls in five minutes. The next tool call can run in 2 seconds." },
      ])
      expect(session.deck).toBe(deck)
      expect(firstOf(deck.register).landed).toEqual([])
    })
  })
})
