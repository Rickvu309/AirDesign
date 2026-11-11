import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { decide, elementId, type Register } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import {
  callTool,
  createServer,
  editLanded,
  emptyLog,
  liveTurn,
  memoryTurns,
  settleTurn,
  type Session,
  type Turns,
} from "./index.js"

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
    expect(turns.read(first.deck.id)).toEqual({ runId: "one", lastCall: tenMinutes - 1, revision: 2 })
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

  it("ends the turn when stop_run or undo_run names its run, and keeps it for another run", async () => {
    for (const tool of ["airdesign_stop_run", "airdesign_undo_run"]) {
      const turns = memoryTurns()
      const session = sessionFor(opened(), turns, "one", 0)
      await edit(session, node, "a", 0)
      const other = sessionFor(session.deck, turns, "two", 1)
      turns.write(other.deck.id, { runId: "two", lastCall: 0, revision: 1 })
      expect((await called(other, tool, { deck: "deck", runId: "one" })).ok).toBe(true)
      expect(turns.read(other.deck.id)).toEqual({ runId: "two", lastCall: 1, revision: 1 })
      const ending = sessionFor(session.deck, turns, "three", 2)
      turns.write(ending.deck.id, { runId: "one", lastCall: 1, revision: 1 })
      const answer = await called(ending, tool, { deck: "deck", runId: "one" })
      expect(answer.ok).toBe(true)
      expect(turns.read(ending.deck.id)).toEqual({ runId: null, lastCall: 2, revision: 2 })
      expect(liveTurn(ending, ending.deck.id)).toBeUndefined()
    }
  })

  it("ends every live run on the deck when the turn ends, in one revision", () => {
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
    turns.write(deck.id, { runId: "first", lastCall: 0, revision: 0 })
    const result = callTool("airdesign_stop_run", { deck: "deck", runId: "first" }, sessionFor(deck, turns, "x", 1))
    if (!result.ok) throw new Error(result.refusal)
    expect(result.deck.revision).toBe(1)
    expect(bodyOf(result.deck.register).phase).toBe("stopped")
    expect(bodyOf(result.deck.register, sibling).phase).toBe("stopped")
  })

  it("never touches the record on a refused call", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    const held = turns.read(session.deck.id)
    session.now = 10
    expect((await called(session, "airdesign_stop_run", { deck: "deck", runId: "unknown" })).refusal).toBe("run-fenced")
    await called(session, "airdesign_capture_slide", { deck: "deck" })
    expect((await edit(session, node, "late", 9)).refusal).toBe("stale")
    expect(turns.read(session.deck.id)).toBe(held)
  })

  it("answers run-fenced inside a turn without retrying or clearing the record", () => {
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
    const held = { runId: "first", lastCall: 0, revision: 0 }
    turns.write(deck.id, held)
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
    expect(minted).toBe(0)
    expect(turns.read(deck.id)).toBe(held)
  })

  it("does not let a settle at a lower revision overwrite a higher one", () => {
    const deck = opened()
    const turns = memoryTurns()
    const session = sessionFor(deck, turns, "late", 5)
    const newer = { runId: "newer", lastCall: 4, revision: 3 }
    turns.write(deck.id, newer)
    settleTurn("edit_deck", editLanded({ ...deck, revision: 2 }, [node], "late"), session)
    expect(turns.read(deck.id)).toEqual({ ...newer, lastCall: 5 })
    const ended = { runId: null, lastCall: 4, revision: 3 }
    turns.write(deck.id, ended)
    settleTurn("edit_deck", editLanded({ ...deck, revision: 2 }, [node], "late"), session)
    expect(turns.read(deck.id)).toEqual(ended)
  })

  it("keeps each deck's turn apart", () => {
    const first = readDeckId("one")
    const second = readDeckId("two")
    if (!first.ok || !second.ok) throw new Error("deck")
    const turns = memoryTurns()
    turns.write(first.deck, { runId: "a", lastCall: 0, revision: 1 })
    expect(turns.read(second.deck)).toBeUndefined()
    turns.write(second.deck, { runId: "b", lastCall: 0, revision: 1 })
    expect(turns.read(first.deck)?.runId).toBe("a")
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
