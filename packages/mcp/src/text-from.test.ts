import { readDeckId } from "@airdesign/catalog"
import { Client, InMemoryTransport } from "@modelcontextprotocol/client"
import { currentValue, decide, elementId, readTextValue, version, writeTextValue } from "@airdesign/document"
import { openDeck, type Deck } from "@airdesign/engine"
import { describe, expect, it } from "vitest"
import { callTool, createServer, editNext, emptyLog, memoryTurns, type Session } from "./index.js"

const floor = writeTextValue([
  {
    from: 0,
    runs: [
      { from: 0, text: "One" },
      { from: 1, text: "Two" },
    ],
  },
  { from: 1, runs: [{ from: 0, text: "Three" }] },
])

const text = elementId("258.7")
const plain = elementId("258.8")
const created = elementId("258.9")

const missingRun = "Paragraph 0 of the file has runs 0 and 1. Use one of them, or -1 for a new run."
const missingParagraph = "The file has paragraphs 0 and 1."
const missingSecondParagraph = "Paragraph 1 of the file has runs 0. Use one of them, or -1 for a new run."
const notText =
  "Send a JSON text value for this layer. Each from must be one the file has, and -1 is a new run. The file has paragraphs 0 and 1."

function opened(): Deck {
  const id = readDeckId("deck")
  if (!id.ok) throw new Error(id.refusal)
  return openDeck(id.deck)
}

function textDeck(): Deck {
  const deck = opened()
  let register = deck.register
  for (const [node, start] of [
    [text, floor],
    [plain, ""],
  ] as const) {
    const added = decide(register, { command: "add", node, floor: start, route: "slide" })
    if (added.decision !== "apply") throw new Error(added.code)
    const started = decide(added.register, { command: "start", runId: "run", node })
    if (started.decision !== "apply") throw new Error(started.code)
    register = started.register
  }
  return { id: deck.id, revision: deck.revision, register }
}

function readFloor() {
  const read = readTextValue(floor)
  if (read === null) throw new Error("floor")
  return read
}

function changedRun(): string {
  return writeTextValue(
    readFloor().map((paragraph) => {
      if (paragraph.from !== 0) return paragraph
      return {
        from: paragraph.from,
        runs: paragraph.runs.map((run) => (run.from === 1 ? { from: run.from, text: "Changed" } : run)),
      }
    }),
  )
}

function newRun(): string {
  return writeTextValue(
    readFloor().map((paragraph) => {
      if (paragraph.from !== 0) return paragraph
      return { from: paragraph.from, runs: [...paragraph.runs, { from: -1, text: "New" }] }
    }),
  )
}

function badRun(): string {
  return writeTextValue([{ from: 0, runs: [{ from: 2, text: "No" }] }])
}

function badParagraph(): string {
  return writeTextValue([{ from: 5, runs: [{ from: 0, text: "No" }] }])
}

function badSecondParagraph(): string {
  return writeTextValue([
    {
      from: 0,
      runs: [
        { from: 0, text: "One" },
        { from: 1, text: "Two" },
      ],
    },
    { from: 1, runs: [{ from: 2, text: "No" }] },
  ])
}

function badSecondRun(): string {
  return writeTextValue([
    {
      from: 0,
      runs: [
        { from: 0, text: "One" },
        { from: 2, text: "No" },
      ],
    },
  ])
}

function runInOtherParagraph(): string {
  return writeTextValue([{ from: 1, runs: [{ from: 1, text: "No" }] }])
}

function droppedRun(): string {
  return writeTextValue([
    { from: 0, runs: [{ from: 0, text: "One" }] },
    { from: 1, runs: [{ from: 0, text: "Three" }] },
  ])
}

function restoredRun(): string {
  return writeTextValue([
    { from: 0, runs: [{ from: 1, text: "Back" }] },
    { from: 1, runs: [{ from: 0, text: "Three" }] },
  ])
}

function sessionFor(deck: Deck): Session {
  const turns = memoryTurns()
  turns.write(deck.id, { runId: "run", lastCall: 0, revision: deck.revision })
  return { caller: { actor: "agent", runId: "run" }, deck, log: emptyLog(), now: 0, turns }
}

function elementBody(deck: Deck, node = text) {
  const body = deck.register.elements[node]
  if (body === undefined) throw new Error("missing element")
  return body
}

type Change = { readonly value: string; readonly node: string; readonly readAt?: number; readonly floor?: string }

function edit(deck: Deck, changes: readonly Change[]) {
  const sent = changes.map((change) => ({ readAt: 0, ...change }))
  return callTool("airdesign_edit_deck", { deck: "deck", base: deck.revision, changes: sent }, sessionFor(deck))
}

function readAnswer(result: { readonly content: readonly { readonly text: string }[] }) {
  return JSON.parse(result.content.at(-1)?.text ?? "null") as {
    ok: boolean
    revision: number
    refusal?: string
    elements: { node: string; value: string; version: number }[]
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

describe("editText", () => {
  it("lands a text edit and returns the current value", () => {
    const deck = textDeck()
    const sent = changedRun()
    const result = edit(deck, [{ value: sent, node: "258.7" }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const before = version(elementBody(deck))
    expect(readAnswer(result)).toEqual({
      ok: true,
      revision: 1,
      runId: "run",
      elements: [{ node: "258.7", value: sent, version: before + 1 }],
    })
    expect(version(elementBody(result.deck))).toBe(before + 1)
    expect(currentValue(elementBody(result.deck))).toBe(sent)
    expect(elementBody(deck).landed).toEqual([])
  })

  it("refuses a run the file does not have", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: badRun(), node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    const before = version(elementBody(deck))
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingRun })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "text-from",
      elements: [{ node: "258.7", value: floor, version: before }],
    })
    expect(version(elementBody(deck))).toBe(before)
    expect(elementBody(deck).landed).toEqual([])
  })

  it("refuses a paragraph the file does not have", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: badParagraph(), node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    const before = version(elementBody(deck))
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingParagraph })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "text-from",
      elements: [{ node: "258.7", value: floor, version: before }],
    })
    expect(version(elementBody(deck))).toBe(before)
    expect(elementBody(deck).landed).toEqual([])
  })

  it("lands a new run", () => {
    const deck = textDeck()
    const sent = newRun()
    const result = edit(deck, [{ value: sent, node: "258.7" }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(currentValue(elementBody(result.deck))).toBe(sent)
    expect(readTextValue(currentValue(elementBody(result.deck)))?.[0]?.runs[2]).toEqual({ from: -1, text: "New" })
    expect(elementBody(deck).landed).toEqual([])
  })

  it("refuses a value that is not a text value", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: "21", node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
    const before = version(elementBody(deck))
    expect(result.content[0]).toEqual({ type: "text", text: editNext["field"] })
    expect(result.content[1]).toEqual({ type: "text", text: notText })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "field",
      elements: [{ node: "258.7", value: floor, version: before }],
    })
    expect(version(elementBody(deck))).toBe(before)
    expect(elementBody(deck).landed).toEqual([])
  })

  it("lands a plain string and returns the current value", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: "21", node: "258.8" }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(elementBody(result.deck, plain).landed).toEqual([
      { actor: "agent", value: "21", visible: true, runId: "run" },
    ])
    const before = version(elementBody(deck, plain))
    expect(currentValue(elementBody(result.deck, plain))).toBe("21")
    expect(readAnswer(result)).toEqual({
      ok: true,
      revision: 1,
      runId: "run",
      elements: [{ node: "258.8", value: "21", version: before + 1 }],
    })
    expect(version(elementBody(result.deck, plain))).toBe(before + 1)
    expect(elementBody(deck, plain).landed).toEqual([])
  })

  it("refuses the whole call when a later change has a bad index", () => {
    const deck = textDeck()
    const result = edit(deck, [
      { value: "kept", node: "258.8" },
      { value: badRun(), node: "258.7" },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]?.text).toBe(editNext["text-from"])
    expect(result.content[1]?.text).toBe(missingRun)
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "text-from",
      elements: [
        { node: "258.8", value: "", version: version(elementBody(deck, plain)) },
        { node: "258.7", value: floor, version: version(elementBody(deck)) },
      ],
    })
    expect(elementBody(deck, plain).landed).toEqual([])
    expect(elementBody(deck).landed).toEqual([])
  })

  it("returns the person's value when the element is protected", () => {
    const started = textDeck()
    const person = decide(started.register, { command: "person", value: "from the person", node: text })
    if (person.decision !== "apply") throw new Error(person.code)
    const deck = { id: started.id, revision: started.revision, register: person.register }
    const result = edit(deck, [{ value: changedRun(), node: "258.7", readAt: 1 }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    const before = version(elementBody(deck))
    expect(before).toBe(1)
    expect(result.refusal).toBe("person-protected")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({
      type: "text",
      text: editNext["person-protected"],
    })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "person-protected",
      elements: [{ node: "258.7", value: "from the person", version: before, closed: true }],
    })
    expect(version(elementBody(result.deck))).toBe(before)
    expect(currentValue(elementBody(deck))).toBe("from the person")
  })

  it("refuses a bad run in the second paragraph", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: badSecondParagraph(), node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingSecondParagraph })
    expect(elementBody(deck).landed).toEqual([])
  })

  it("refuses a bad from in the second run", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: badSecondRun(), node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingRun })
    expect(elementBody(deck).landed).toEqual([])
  })

  it("refuses a run from that another paragraph of the file has", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: runInOtherParagraph(), node: "258.7" }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingSecondParagraph })
    expect(elementBody(deck).landed).toEqual([])
  })

  it("lands a floor run the current value dropped", () => {
    const deck = textDeck()
    const first = edit(deck, [{ value: droppedRun(), node: "258.7" }])
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(version(elementBody(first.deck))).toBe(1)
    const sent = restoredRun()
    const second = edit(first.deck, [{ value: sent, node: "258.7" }])
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(currentValue(elementBody(second.deck))).toBe(sent)
    expect(version(elementBody(second.deck))).toBe(2)
    expect(elementBody(deck).landed).toEqual([])
  })

  it("lists a node once when one call changes it twice", () => {
    const deck = textDeck()
    const result = edit(deck, [
      { value: "21", node: "258.8" },
      { value: "22", node: "258.8" },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(elementBody(result.deck, plain).landed.map((row) => row.value)).toEqual(["21", "22"])
    expect(version(elementBody(result.deck, plain))).toBe(version(elementBody(deck, plain)) + 2)
    expect(readAnswer(result).elements).toEqual([{ node: "258.8", value: "22", version: 2 }])
  })

  it("refuses another deck before the text check", () => {
    const deck = textDeck()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "other", base: 0, changes: [{ value: badRun(), node: "258.7", readAt: 0 }] },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("deck")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({
      type: "text",
      text: editNext.deck,
    })
    expect(readAnswer(result)).toEqual({ ok: false, revision: 0, refusal: "deck", elements: [] })
    expect(elementBody(deck).landed).toEqual([])
  })

  it("does not carry a value when the arguments cannot be read", () => {
    const deck = textDeck()
    const result = callTool(
      "airdesign_edit_deck",
      { deck: "deck", base: 0, changes: [{ value: "21", node: "258.7", readAt: 0 }], actor: "person" },
      sessionFor(deck),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    const answer = { ok: false, revision: 0, refusal: "field", elements: [] }
    expect(result.content).toEqual([
      { type: "text", text: editNext.field },
      { type: "text", text: JSON.stringify(answer) },
    ])
    expect(result.answer?.elements).toEqual([])
    expect(result.deck).toBe(deck)
  })

  it("refuses a bad run on a new element against the change's own floor and creates nothing", () => {
    const deck = textDeck()
    const result = edit(deck, [{ value: badRun(), node: "258.9", floor }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingRun })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "text-from",
      elements: [{ node: "258.9", value: "", version: 0 }],
    })
    expect(deck.register.nodes).not.toContain(created)
    expect(deck.register.elements[created]).toBeUndefined()
  })

  it("lands a new element whose text value uses its own floor's indexes", () => {
    const deck = textDeck()
    const sent = newRun()
    const result = edit(deck, [{ value: sent, node: "258.9", floor }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(elementBody(result.deck, created).floor).toBe(floor)
    expect(currentValue(elementBody(result.deck, created))).toBe(sent)
    expect(readAnswer(result)).toEqual({
      ok: true,
      revision: 1,
      runId: "run",
      elements: [{ node: "258.9", value: sent, version: 1 }],
    })
    expect(deck.register.elements[created]).toBeUndefined()
  })

  it("checks a second change on a new element that brings no floor against the first change's floor", () => {
    const deck = textDeck()
    const result = edit(deck, [
      { value: changedRun(), node: "258.9", floor },
      { value: badParagraph(), node: "258.9" },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("text-from")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["text-from"] })
    expect(result.content[1]).toEqual({ type: "text", text: missingParagraph })
    expect(deck.register.nodes).not.toContain(created)
    expect(deck.register.elements[created]).toBeUndefined()
  })

  it("refuses a second change on a new element that brings a different floor", () => {
    const deck = textDeck()
    const result = edit(deck, [
      { value: changedRun(), node: "258.9", floor },
      { value: badParagraph(), node: "258.9", floor: "plain" },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("field")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext.field })
    expect(deck.register.nodes).not.toContain(created)
    expect(deck.register.elements[created]).toBeUndefined()
  })

  it("lands a good second change on a new element against the first change's floor", () => {
    const deck = textDeck()
    const sent = newRun()
    const result = edit(deck, [
      { value: changedRun(), node: "258.9", floor },
      { value: sent, node: "258.9", readAt: 1 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(elementBody(result.deck, created).floor).toBe(floor)
    expect(elementBody(result.deck, created).landed.map((row) => row.value)).toEqual([changedRun(), sent])
    expect(readAnswer(result)).toEqual({
      ok: true,
      revision: 1,
      runId: "run",
      elements: [{ node: "258.9", value: sent, version: 2 }],
    })
  })

  it("answers person-protected, not stale, when a person edited the element during the run", () => {
    const started = textDeck()
    const person = decide(started.register, { command: "person", value: "from the person", node: text })
    if (person.decision !== "apply") throw new Error(person.code)
    const deck = { id: started.id, revision: started.revision, register: person.register }
    const result = edit(deck, [{ value: changedRun(), node: "258.7", readAt: 0 }])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.refusal).toBe("person-protected")
    expect(result.deck).toBe(deck)
    expect(result.content[0]).toEqual({ type: "text", text: editNext["person-protected"] })
    expect(readAnswer(result)).toEqual({
      ok: false,
      revision: 0,
      refusal: "person-protected",
      elements: [{ node: "258.7", value: "from the person", version: 1, closed: true }],
    })
  })

  it("refuses a missing run through the client", async () => {
    const deck = textDeck()
    const session = sessionFor(deck)
    await withClient(session, async (client) => {
      const result = await client.callTool({
        name: "airdesign_edit_deck",
        arguments: { deck: "deck", base: 0, changes: [{ value: badRun(), node: "258.7", readAt: 0 }] },
      })
      expect(result.isError).toBe(true)
      const block = {
        ok: false,
        revision: 0,
        refusal: "text-from",
        elements: [{ node: "258.7", value: floor, version: 0 }],
      }
      expect(result.content).toEqual([
        { type: "text", text: editNext["text-from"] },
        { type: "text", text: missingRun },
        { type: "text", text: JSON.stringify(block) },
      ])
      expect(result.structuredContent).toEqual(block)
      expect(session.deck).toBe(deck)
      expect(elementBody(session.deck).landed).toEqual([])
      expect(session.log.events).toHaveLength(1)
    })
  })
})
