import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { decide, elementId, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { callTool, createServer, emptyLog, memoryTurns, settleTurn, type Session, type Turns } from "./index.js"

const node = elementId("258.7")
const sibling = elementId("258.8")
const tenMinutes = 600_000

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function sessionFor(deck: Deck, turns: Turns, runId: string, now: number): Session {
  return { caller: { actor: "agent", runId }, deck, log: emptyLog(), now, turns }
}

function bodyOf(register: Register, id = node) {
  const body = register.elements[id]
  if (body === undefined) throw new Error("missing node")
  return body
}

function change(id: typeof node, value: string, readAt: number) {
  return { deck: "deck", base: 0, changes: [{ value, node: id, readAt }] }
}

async function called(session: Session, name: string, raw: Record<string, unknown>) {
  const server = createServer(session)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: "airdesign-test", version: "0.0.0" })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    const result = await client.callTool({ name, arguments: raw })
    return result.structuredContent as { ok: boolean; refusal?: string; runId?: string }
  } finally {
    await client.close()
    await server.close()
  }
}

function edit(session: Session, id: typeof node, value: string, readAt: number) {
  return called(session, "airdesign_edit_deck", change(id, value, readAt))
}

describe("the turn", () => {
  it("joins a second element in one turn under the first element's run", async () => {
    const turns = memoryTurns()
    const first = sessionFor(opened(), turns, "one", 0)
    expect((await edit(first, node, "a", 0)).runId).toBe("one")
    const second = sessionFor(first.deck, turns, "two", tenMinutes - 1)
    expect((await edit(second, sibling, "b", 0)).runId).toBe("one")
    expect(bodyOf(second.deck.register, sibling).runId).toBe("one")
    expect(turns.read(first.deck.id)).toEqual({ runId: "one", lastCall: tenMinutes - 1 })
  })

  it("treats a call exactly at the idle window as idle and honours a shorter window", async () => {
    const turns = memoryTurns()
    const first = sessionFor(opened(), turns, "one", 0)
    await edit(first, node, "a", 0)
    const late = sessionFor(first.deck, turns, "two", tenMinutes)
    expect((await edit(late, node, "b", 1)).runId).toBe("two")
    const short = { ...sessionFor(late.deck, turns, "three", tenMinutes + 5), idleWindow: 5 }
    expect((await edit(short, node, "c", 2)).runId).toBe("three")
  })

  it("clears the record when stop_run names the turn's run, and keeps it for another run", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    const other = sessionFor(session.deck, turns, "two", 1)
    turns.write(other.deck.id, { runId: "two", lastCall: 0 })
    expect((await called(other, "airdesign_stop_run", { deck: "deck", runId: "one" })).ok).toBe(true)
    expect(turns.read(other.deck.id)).toEqual({ runId: "two", lastCall: 1 })
    turns.write(other.deck.id, { runId: "one", lastCall: 1 })
    expect((await called(other, "airdesign_stop_run", { deck: "deck", runId: "one" })).ok).toBe(true)
    expect(turns.read(other.deck.id)).toBeUndefined()
  })

  it("keeps the record when a stop_run is refused", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    const answer = await called(session, "airdesign_stop_run", { deck: "deck", runId: "unknown" })
    expect(answer.refusal).toBe("run-fenced")
    expect(turns.read(session.deck.id)).toEqual({ runId: "one", lastCall: 0 })
  })

  it("does not revive an expired turn on a later call", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    session.now = tenMinutes
    await called(session, "airdesign_capture_slide", { deck: "deck" })
    expect(turns.read(session.deck.id)).toEqual({ runId: "one", lastCall: 0 })
  })

  it("moves the last call on a refused tool call inside the window", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    session.now = 10
    await called(session, "airdesign_capture_slide", { deck: "deck" })
    expect(turns.read(session.deck.id)).toEqual({ runId: "one", lastCall: 10 })
  })

  it("clears the record and goes through the no-record path once on run-fenced", () => {
    let register = opened().register
    for (const command of [
      { command: "add", node, floor: "", route: "" },
      { command: "add", node: sibling, floor: "", route: "" },
      { command: "start", runId: "first", node },
      { command: "start", runId: "second", node: sibling },
    ] as const) {
      const decision = decide(register, command)
      if (decision.decision !== "apply") throw new Error(decision.code)
      register = decision.register
    }
    const deck = { ...opened(), register }
    const turns = memoryTurns()
    turns.write(deck.id, { runId: "first", lastCall: 0 })
    let minted = 0
    const session: Session = {
      get caller() {
        minted += 1
        return { actor: "agent" as const, runId: "fresh" }
      },
      deck,
      log: emptyLog(),
      now: 1,
      turns,
    }
    const result = callTool(
      "airdesign_edit_deck",
      {
        deck: "deck",
        base: 0,
        changes: [
          { value: "a", node, readAt: 0 },
          { value: "b", node: sibling, readAt: 0 },
        ],
      },
      session,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("run-fenced")
    expect(result.deck).toBe(deck)
    expect(minted).toBe(1)
    expect(turns.read(deck.id)).toBeUndefined()
  })

  it("writes nothing to the record when an edit is refused before any turn exists", () => {
    const deck = opened()
    const turns = memoryTurns()
    const session = sessionFor(deck, turns, "one", 0)
    const result = callTool("airdesign_edit_deck", { deck: "deck", base: 0, changes: [] }, session)
    settleTurn("edit_deck", result, session)
    expect(result.ok).toBe(false)
    expect(turns.read(deck.id)).toBeUndefined()
  })

  it("answers a malformed run id as run-fenced and a missing one as a field", () => {
    const session = sessionFor(opened(), memoryTurns(), "one", 0)
    for (const tool of ["airdesign_stop_run", "airdesign_undo_run"]) {
      const malformed = callTool(tool, { deck: "deck", runId: "../bad" }, session)
      expect(!malformed.ok && malformed.refusal).toBe("run-fenced")
      const missing = callTool(tool, { deck: "deck" }, session)
      expect(!missing.ok && missing.refusal).toBe("field")
    }
  })
})
