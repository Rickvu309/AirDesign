import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { decide, elementId, limits, type Register } from "@airdesign/document"
import { call, indexDeck, openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import {
  callTool,
  createServer,
  dropGoneTurn,
  editLanded,
  editRefusal,
  emptyLog,
  liveTurn,
  memoryTurns,
  settleTurn,
  type EditCode,
  type Host,
  type Session,
  type Turns,
} from "./index.js"

const node = elementId("258.7")
const sibling = elementId("258.8")
const created = elementId("258.n0123456789ab")
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

async function called(session: Session, name: string, raw: Record<string, unknown>, host?: Host) {
  const server = createServer(session, host)
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

  it("joins the run of a call whose turn is not saved yet, at the same read and on another element", async () => {
    const first = sessionFor(opened(), memoryTurns(), "one", 0)
    expect((await edit(first, node, "a", 0)).runId).toBe("one")
    const same = sessionFor(first.deck, memoryTurns(), "two", 0)
    expect((await edit(same, node, "b", 0)).runId).toBe("one")
    expect(bodyOf(same.deck.register).landed.map((item) => item.value)).toEqual(["a", "b"])
    const other = sessionFor(first.deck, memoryTurns(), "three", 0)
    expect((await edit(other, sibling, "c", 0)).runId).toBe("one")
    expect(bodyOf(other.deck.register).phase).toBe("running")
    expect(bodyOf(other.deck.register).runId).toBe("one")
  })

  it("joins the run of an edit whose turn is not saved yet from a slide tool call", async () => {
    const indexed = indexDeck(
      opened(),
      { actor: "person" },
      {
        deck: "deck",
        once: "index",
        offset: 0,
        total: 1,
        slides: [{ id: "258", position: 0, layout: [] }],
        elements: [{ node, kind: "shape", value: "", box: null, grouped: false }],
      },
    )
    if (!indexed.ok) throw new Error(indexed.refusal)
    const first = sessionFor(indexed.deck, memoryTurns(), "one", 0)
    await edit(first, node, "a", 0)
    const slide = sessionFor(first.deck, memoryTurns(), "two", 0)
    const answer = await called(slide, "airdesign_edit_deck", {
      deck: "deck",
      base: first.deck.revision,
      changes: [{ op: "add_slide", after: "258", layout: "258" }],
    })
    expect(answer).toMatchObject({ ok: true, runId: "one" })
    expect(bodyOf(slide.deck.register).phase).toBe("running")
  })

  it("takes no run the deck records ended as the turn's run, so the next slide lands under a new run", async () => {
    const indexed = indexDeck(
      opened(),
      { actor: "person" },
      {
        deck: "deck",
        once: "index",
        offset: 0,
        total: 1,
        slides: [{ id: "258", position: 0, layout: [] }],
        elements: [{ node, kind: "shape", value: "", box: null, grouped: false }],
      },
    )
    if (!indexed.ok) throw new Error(indexed.refusal)
    const turns = memoryTurns()
    const first = sessionFor(indexed.deck, turns, "one", 0)
    const slide = { deck: "deck", after: "258", layout: "258" }
    expect(
      await called(first, "airdesign_edit_deck", {
        base: first.deck.revision,
        deck: "deck",
        changes: [{ op: "add_slide", after: slide.after, layout: slide.layout }],
      }),
    ).toMatchObject({
      runId: "one",
    })
    const undone = call("undo_run", first.deck, { actor: "person" }, { deck: "deck", runId: "one" })
    if (!undone.ok) throw new Error(undone.refusal)
    const next = sessionFor(undone.deck, turns, "two", 1)
    expect(turns.read(next.deck.id)?.runId).toBe("one")
    expect(liveTurn(next, next.deck.id)).toBeUndefined()
    expect(
      await called(next, "airdesign_edit_deck", {
        base: undone.deck.revision,
        deck: "deck",
        changes: [{ op: "add_slide", after: slide.after, layout: slide.layout }],
      }),
    ).toMatchObject({
      ok: true,
      runId: "two",
    })
    expect(turns.read(next.deck.id)?.runId).toBe("two")
  })

  it("opens a new run for the next edit after a person's run Undo of the turn's run", async () => {
    const turns = memoryTurns()
    const first = sessionFor(opened(), turns, "one", 0)
    expect((await edit(first, node, "a", 0)).runId).toBe("one")
    const undone = call("undo_run", first.deck, { actor: "person" }, { deck: "deck", runId: "one" })
    if (!undone.ok) throw new Error(undone.refusal)
    const next = sessionFor(undone.deck, turns, "two", 1)
    expect(
      await called(next, "airdesign_edit_deck", { ...change(node, "b", 2), base: undone.deck.revision }),
    ).toMatchObject({
      ok: true,
      runId: "two",
    })
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

  it("ends the turn when stop_run names its run, and keeps it for another run", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    const other = sessionFor(session.deck, turns, "two", 1)
    turns.write(other.deck.id, { runId: "two", lastCall: 0, revision: 1 })
    expect((await called(other, "airdesign_stop_run", { deck: "deck", runId: "one" })).ok).toBe(true)
    expect(turns.read(other.deck.id)).toEqual({ runId: "two", lastCall: 1, revision: 1 })
    const ending = sessionFor(session.deck, turns, "three", 2)
    turns.write(ending.deck.id, { runId: "one", lastCall: 1, revision: 1 })
    const answer = await called(ending, "airdesign_stop_run", { deck: "deck", runId: "one" })
    expect(answer.ok).toBe(true)
    expect(turns.read(ending.deck.id)).toEqual({ runId: null, lastCall: 2, revision: 2 })
    expect(liveTurn(ending, ending.deck.id)).toBeUndefined()
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

  it("keeps each deck's turn apart", async () => {
    const first = readDeckId("one")
    const second = readDeckId("two")
    if (!first.ok || !second.ok) throw new Error("deck")
    const turns = memoryTurns()
    const one = sessionFor(openDeck(first.deck), turns, "a", 0)
    const two = sessionFor(openDeck(second.deck), turns, "b", 0)
    const on = (id: string, value: string, readAt: number, element = node) => ({
      deck: id,
      base: 0,
      changes: [{ value, node: element, readAt }],
    })
    expect((await called(one, "airdesign_edit_deck", on("one", "a", 0))).runId).toBe("a")
    expect((await called(two, "airdesign_edit_deck", on("two", "b", 0))).runId).toBe("b")
    const next = sessionFor(one.deck, turns, "c", 1)
    expect((await called(next, "airdesign_edit_deck", on("one", "a2", 0, sibling))).runId).toBe("a")
    expect(bodyOf(next.deck.register, sibling).runId).toBe("a")
    expect(bodyOf(two.deck.register).runId).toBe("b")
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

  it("answers a malformed run id as run-fenced and a missing one as a field, and the next edit still joins", async () => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    const before = session.deck
    const malformed = callTool("airdesign_stop_run", { deck: "deck", runId: "../bad" }, session)
    expect(!malformed.ok && malformed.refusal).toBe("run-fenced")
    const missing = callTool("airdesign_stop_run", { deck: "deck" }, session)
    expect(!missing.ok && missing.refusal).toBe("field")
    expect(session.deck).toBe(before)
    expect((await edit(session, node, "b", 1)).runId).toBe("one")
  })

  it("treats a record ahead of the loaded row as a deck that no longer exists", async () => {
    const turns = memoryTurns()
    const deck = opened()
    turns.write(deck.id, { runId: "old", lastCall: 0, revision: 3 })
    const session = sessionFor(deck, turns, "fresh", 1)
    dropGoneTurn(session, turns.read(deck.id))
    expect((await edit(session, node, "a", 0)).runId).toBe("fresh")
    expect(turns.read(deck.id)).toEqual({ runId: "fresh", lastCall: 1, revision: 1 })
  })

  it("keeps a record written after the snapshot, and one no newer than the loaded row", () => {
    const turns = memoryTurns()
    const deck = { ...opened(), revision: 3 }
    const session = sessionFor(deck, turns, "fresh", 1)
    const newer = { runId: "newer", lastCall: 0, revision: 5 }
    turns.write(deck.id, newer)
    dropGoneTurn(session, { runId: "old", lastCall: 0, revision: 4 })
    expect(turns.read(deck.id)).toBe(newer)
    dropGoneTurn(session, { runId: "newer", lastCall: 0, revision: 3 })
    expect(turns.read(deck.id)).toBe(newer)
  })

  const textFloor = JSON.stringify([{ from: 0, runs: [{ from: 0, text: "Before" }] }])
  const badText = JSON.stringify([{ from: 0, runs: [{ from: 3, text: "After" }] }])
  const failing = (refusal: EditCode): Host => ({
    commit: (_result, session) => Promise.resolve(editRefusal(session.deck, refusal, [sibling])),
  })
  const refusals: readonly {
    readonly kind: EditCode
    readonly tool: string
    readonly raw: Record<string, unknown>
    readonly host?: Host
  }[] = [
    { kind: "stale", tool: "airdesign_edit_deck", raw: change(sibling, "b", 9) },
    { kind: "person-protected", tool: "airdesign_edit_deck", raw: change(node, "b", 2) },
    { kind: "run-fenced", tool: "airdesign_stop_run", raw: { deck: "deck", runId: "unknown" } },
    { kind: "batch", tool: "airdesign_edit_deck", raw: { deck: "deck", base: 0, changes: [] } },
    { kind: "limit", tool: "airdesign_edit_deck", raw: change(sibling, "x".repeat(limits.valueBytes + 1), 1) },
    { kind: "field", tool: "airdesign_edit_deck", raw: { ...change(sibling, "b", 1), actor: "person" } },
    { kind: "store", tool: "airdesign_edit_deck", raw: change(sibling, "b", 1), host: failing("store") },
    {
      kind: "text-from",
      tool: "airdesign_edit_deck",
      raw: { deck: "deck", base: 0, changes: [{ value: badText, node: created, readAt: 0, floor: textFloor }] },
    },
    { kind: "dead", tool: "airdesign_edit_deck", raw: change(sibling, "b", 1), host: failing("dead") },
  ]

  it.each(refusals)("keeps a closed element closed on the next call after a $kind refusal", async (row) => {
    const turns = memoryTurns()
    const session = sessionFor(opened(), turns, "one", 0)
    await edit(session, node, "a", 0)
    await edit(session, sibling, "b", 0)
    const typed = decide(session.deck.register, { command: "person", value: "typed", node })
    if (typed.decision !== "apply") throw new Error(typed.code)
    session.deck = { ...session.deck, revision: session.deck.revision + 1, register: typed.register }
    const closed = session.deck
    const answer = await called(session, row.tool, row.raw, row.host)
    expect(answer.refusal).toBe(row.kind)
    expect(session.deck).toBe(closed)
    const next = await edit(session, node, "overwrite", 2)
    expect(next.refusal).toBe("person-protected")
    expect(bodyOf(session.deck.register).landed.map((item) => item.value)).toEqual(["a", "typed"])
  })
})
