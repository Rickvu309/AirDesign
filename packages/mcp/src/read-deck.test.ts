import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { decide, elementId, openRegister, type Command, type Register } from "@airdesign/document"
import { openDeck, readReport, withinRead, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { callTool, createServer, emptyLog, memoryTurns, type Session } from "./index.js"

function apply(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function opened(id = "deck"): Deck {
  const parsed = readDeckId(id)
  if (!parsed.ok) throw new Error(parsed.refusal)
  return openDeck(parsed.deck)
}

function withNode(deck: Deck, commands: readonly Command[]): Deck {
  let register = deck.register
  for (const command of commands) register = apply(register, command)
  return { id: deck.id, revision: deck.revision, register }
}

function sessionFor(deck: Deck, owned?: Session["owned"]): Session {
  return {
    caller: { actor: "agent", runId: "session" },
    deck,
    log: emptyLog(),
    now: 0,
    turns: memoryTurns(),
    ...(owned === undefined ? {} : { owned }),
  }
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

const node = elementId("258.7")
const other = elementId("258.8")

describe("read and list tools", () => {
  it("reads the loaded deck without writing it or starting a turn", () => {
    const deck = withNode(opened(), [
      { command: "add", node, floor: "", route: "slide" },
      { command: "person", node, value: "Before" },
      { command: "start", node, runId: "mine" },
    ])
    const session = sessionFor(deck)
    session.turns.write(deck.id, { runId: "mine", lastCall: 0, revision: deck.revision })
    const before = session.deck
    const result = callTool("airdesign_read_deck", { deck: "deck" }, session)
    expect(result.ok).toBe(true)
    if (!result.ok || result.reported === undefined || !("elements" in result.reported)) throw new Error("read")
    expect(result.deck).toBe(before)
    expect(result.reported).toMatchObject({
      ok: true,
      revision: 0,
      elements: [{ node: "258.7", slide: "258", value: "Before", version: 1 }],
    })
    expect(result.reported.elements[0]).not.toHaveProperty("closed")
    expect(result.content[0]?.text).toBe("Read revision 0.")
    expect(session.turns.read(deck.id)?.runId).toBe("mine")
    expect(withinRead(readReport(result.content[0]?.text ?? "", result.reported))).toBe(true)
  })

  it("tells the agent which text a tab measured as overflowing at the revision it reads", () => {
    const deck = withNode(opened(), [
      { command: "add", node, floor: "", route: "slide" },
      { command: "person", node, value: "A title that wraps past its box" },
    ])
    const overflow = { needed: 86.4, room: 64.8, fix: { size: 28, height: 93.6 } }
    const session = { ...sessionFor(deck), findings: { deck: deck.id, revision: 0, overflow: [{ node, ...overflow }] } }
    const result = callTool("airdesign_read_deck", { deck: "deck" }, session)
    if (!result.ok || result.reported === undefined || !("elements" in result.reported)) throw new Error("read")
    expect(result.reported).toMatchObject({ findings: "ready", elements: [{ node: "258.7", overflow }] })
    const unmeasured = callTool("airdesign_read_deck", { deck: "deck" }, sessionFor(deck))
    if (!unmeasured.ok || unmeasured.reported === undefined || !("elements" in unmeasured.reported))
      throw new Error("read")
    expect(unmeasured.reported).toMatchObject({ findings: "missing" })
    expect(unmeasured.reported.elements[0]).not.toHaveProperty("overflow")
  })

  it("closes an element held by a run other than this turn, including the caller run", () => {
    let register = openRegister("", "slide")
    register = apply(register, { command: "add", node, floor: "", route: "slide" })
    register = apply(register, { command: "person", node, value: "Mine" })
    register = apply(register, { command: "start", node, runId: "mine" })
    register = apply(register, { command: "add", node: other, floor: "", route: "slide" })
    register = apply(register, { command: "person", node: other, value: "Caller" })
    register = apply(register, { command: "start", node: other, runId: "session" })
    const guarded = elementId("259.1")
    register = apply(register, { command: "add", node: guarded, floor: "", route: "slide" })
    register = apply(register, { command: "person", node: guarded, value: "Old" })
    register = apply(register, { command: "start", node: guarded, runId: "mine" })
    register = apply(register, { command: "person", node: guarded, value: "New" })
    const deck = { ...opened(), register }
    const session = sessionFor(deck)
    session.turns.write(deck.id, { runId: "mine", lastCall: 0, revision: 0 })
    const result = callTool("airdesign_read_deck", { deck: "deck" }, session)
    if (!result.ok || result.reported === undefined || !("elements" in result.reported)) throw new Error("read")
    const read = new Map(result.reported.elements.map((element) => [element.node, element.closed]))
    expect(read.get(node)).toBeUndefined()
    expect(read.get(other)).toBe(true)
    expect(read.get(guarded)).toBe(true)
  })

  it("refuses a read that does not name the loaded deck", () => {
    const session = sessionFor(opened())
    const result = callTool("airdesign_read_deck", { deck: "other" }, session)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("read")
    expect(result.refusal).toBe("deck")
    expect(result.deck).toBe(session.deck)
    expect(callTool("airdesign_read_deck", { deck: "deck", slide: "nope" }, session).ok).toBe(false)
  })

  it("lists the decks prepared for this account", () => {
    const kept = readDeckId("kept")
    const bin = readDeckId("bin")
    if (!kept.ok || !bin.ok) throw new Error("deck")
    const session = sessionFor(opened(), [
      { deck: kept.deck, name: "Kept", trash: false },
      { deck: bin.deck, name: "", trash: true },
    ])
    const result = callTool("airdesign_list_decks", {}, session)
    expect(result.ok).toBe(true)
    if (!result.ok || result.reported === undefined || !("decks" in result.reported)) throw new Error("list")
    expect(result.deck).toBe(session.deck)
    expect(result.reported).toEqual({
      ok: true,
      decks: [
        { deck: "kept", name: "Kept", trash: false },
        { deck: "bin", name: "", trash: true },
      ],
    })
    expect(result.content[0]?.text).toBe("Decks this account owns.")
    expect(callTool("airdesign_list_decks", {}, sessionFor(opened())).ok).toBe(true)
    const extra = callTool("airdesign_list_decks", { deck: "deck" }, session)
    expect(extra.ok).toBe(false)
    if (extra.ok) throw new Error("list")
    expect(extra.refusal).toBe("field")
  })

  it("pages a large read inside the token budget", () => {
    const commands: Command[] = []
    for (let index = 1; index <= 120; index += 1) {
      const id = elementId(`${String(index)}.1`)
      commands.push(
        { command: "add", node: id, floor: "", route: "slide" },
        { command: "person", node: id, value: "x".repeat(400) },
      )
    }
    const session = sessionFor(withNode(opened(), commands))
    const result = callTool("airdesign_read_deck", { deck: "deck" }, session)
    if (
      !result.ok ||
      result.reported === undefined ||
      !("elements" in result.reported) ||
      result.reported.cursor === undefined
    ) {
      throw new Error("read")
    }
    expect(withinRead(readReport(result.content[0]?.text ?? "", result.reported))).toBe(true)
    const next = callTool("airdesign_read_deck", { deck: "deck", cursor: result.reported.cursor }, session)
    if (!next.ok || next.reported === undefined || !("elements" in next.reported)) throw new Error("next")
    expect(next.reported.elements[0]?.node).not.toBe(result.reported.elements[0]?.node)
    expect(withinRead(readReport(next.content[0]?.text ?? "", next.reported))).toBe(true)
  })

  it("counts a read and a list toward the tool call limit", async () => {
    const session = sessionFor(opened())
    await withClient(session, async (client) => {
      await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
      await client.callTool({ name: "airdesign_list_decks", arguments: {} })
    })
    expect(session.log.events.filter((event) => event.kind === "tool")).toHaveLength(2)
    expect(session.turns.read(session.deck.id)).toBeUndefined()
  })

  it("refuses the thirty-first tool call without changing the deck", async () => {
    const session = sessionFor(withNode(opened(), [{ command: "add", node, floor: "", route: "slide" }]))
    const before = session.deck
    session.log = { events: Array.from({ length: 30 }, () => ({ kind: "tool" as const, at: 0 })) }
    await withClient(session, async (client) => {
      const result = await client.callTool({ name: "airdesign_read_deck", arguments: { deck: "deck" } })
      expect(result.isError).toBe(true)
      expect(result.content).toContainEqual({
        type: "text",
        text: "Thirty tool calls in five minutes. The next tool call can run in 300 seconds.",
      })
    })
    expect(session.deck).toBe(before)
    expect(session.log.events).toHaveLength(30)
    expect(session.deck.register.nodes).toContain(node)
  })
})
