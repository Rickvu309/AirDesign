import { readDeckId } from "@airdesign/catalog"
import {
  decide,
  elementId,
  limits,
  openRegister,
  type Command,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  call,
  indexDeck,
  listLead,
  openDeck,
  ownedDecks,
  pageOwned,
  readDeckPage,
  readLead,
  readReport,
  readTokens,
  withinRead,
  type Deck,
  type ListDeckAnswer,
  type OwnedDeck,
  type OwnedRow,
  type ReadDeckAnswer,
  type ReadElement,
} from "./index.js"

function readDeckIdOf(id: string) {
  const parsed = readDeckId(id)
  if (!parsed.ok) throw new Error(parsed.refusal)
  return parsed.deck
}

function apply(register: Register, command: Command): Register {
  const decision = decide(register, command)
  if (decision.decision !== "apply") throw new Error(decision.code)
  return decision.register
}

function grown(commands: readonly Command[]): Register {
  let register = openRegister("shell", "slide")
  for (const command of commands) register = apply(register, command)
  return register
}

function deckOf(revision: number, register: Register, id = "deck"): Deck {
  const parsed = readDeckId(id)
  if (!parsed.ok) throw new Error(parsed.refusal)
  return { id: parsed.deck, revision, register }
}

function added(node: ElementId): Command {
  return { command: "add", node, floor: "", route: "slide" }
}

function text(node: ElementId, value: string): Command {
  return { command: "person", node, value }
}

const box = { x: 10, y: 20, cx: 30, cy: 40 }
const title = elementId("258.7")
const body = elementId("258.8")
const note = elementId("259.1")
const footer = elementId("259.2")
const aside = elementId("259.3")

function held(): Deck {
  const register = grown([
    added(title),
    text(title, "Before"),
    { command: "person", node: title, property: "box", value: box },
    { command: "start", node: title, runId: "mine" },
    added(body),
    text(body, "Other"),
    { command: "start", node: body, runId: "other" },
    added(note),
    text(note, "Guarded"),
    { command: "start", node: note, runId: "mine" },
    text(note, "During"),
    added(footer),
    text(footer, "Stopped"),
    { command: "start", node: footer, runId: "mine" },
    { command: "stop", node: footer, runId: "mine" },
    added(aside),
    text(aside, "Idle"),
  ])
  return deckOf(7, register)
}

function byNode(answer: ReadDeckAnswer): Map<string, ReadElement> {
  return new Map(answer.elements.map((element) => [element.node, element]))
}

describe("readDeckPage", () => {
  it("returns the deck revision for base and each element's version for readAt", () => {
    const deck = held()
    const before = deck.register
    const answer = readDeckPage(deck, { runId: "mine" })
    expect(deck.register).toBe(before)
    expect(answer.revision).toBe(7)
    expect(answer.cursor).toBeUndefined()
    expect(answer.elements.map((element) => element.node)).toEqual(["258.7", "258.8", "259.1", "259.2", "259.3"])
    expect(answer.elements.some((element) => element.node === "a" || element.value === "shell")).toBe(false)
    const read = byNode(answer)
    expect(read.get("258.7")).toEqual({
      node: title,
      slide: "258",
      value: "Before",
      version: 2,
      box,
    })
    expect(read.get("258.7")).not.toHaveProperty("closed")
    expect(read.get("258.8")).toMatchObject({ slide: "258", value: "Other", version: 1, closed: true })
    expect(read.get("259.1")).toMatchObject({ value: "During", closed: true })
    expect(read.get("259.2")).toEqual({ node: footer, slide: "259", value: "Stopped", version: 1 })
    expect(read.get("259.3")).toEqual({ node: aside, slide: "259", value: "Idle", version: 1 })
    expect(read.get("259.2")).not.toHaveProperty("box")
  })

  it("closes every running element when this caller has no turn", () => {
    const answer = readDeckPage(held(), { runId: null })
    const read = byNode(answer)
    expect(read.get("258.7")?.closed).toBe(true)
    expect(read.get("258.8")?.closed).toBe(true)
    expect(read.get("259.1")?.closed).toBe(true)
    expect(read.get("259.2")?.closed).toBeUndefined()
    expect(read.get("259.3")?.closed).toBeUndefined()
  })

  it("returns an empty element list for a deck nobody has edited", () => {
    const answer: ReadDeckAnswer = readDeckPage(deckOf(0, openRegister("", "")), { runId: null })
    expect(answer).toEqual({ ok: true, revision: 0, elements: [], slides: [], index: "missing" })
    expect(withinRead(readReport(readLead(answer.revision), answer))).toBe(true)
    expect(readTokens).toBe(8000)
  })

  it("filters one slide and continues after a cursor", () => {
    const deck = held()
    const slide = readDeckPage(deck, { runId: "mine", slide: "258" })
    expect(slide.elements.map((element) => element.slide)).toEqual(["258", "258"])
    const next = readDeckPage(deck, { runId: "mine", cursor: "258.7" })
    expect(next.elements.map((element) => element.node)).toEqual(["258.8", "259.1", "259.2", "259.3"])
    const gone = readDeckPage(deck, { runId: "mine", cursor: "258.75" })
    expect(gone.elements.map((element) => element.node)).toEqual(["258.8", "259.1", "259.2", "259.3"])
    expect(readDeckPage(deck, { runId: "mine", slide: "300" }).elements).toEqual([])
  })

  it("pages a deck so each answer stays inside the read budget", () => {
    const commands: Command[] = []
    const ids: ElementId[] = []
    for (let index = 1; index <= 120; index += 1) {
      const node = elementId(`${String(index)}.1`)
      ids.push(node)
      commands.push(added(node), text(node, "x".repeat(400)))
    }
    const deck = deckOf(3, grown(commands))
    const first = readDeckPage(deck, { runId: null })
    expect(first.cursor).toBe(first.elements.at(-1)?.node)
    expect(withinRead(readReport(readLead(first.revision), first))).toBe(true)
    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 40; guard += 1) {
      const answer = readDeckPage(deck, cursor === undefined ? { runId: null } : { runId: null, cursor })
      expect(withinRead(readReport(readLead(answer.revision), answer)), cursor ?? "start").toBe(true)
      expect(answer.elements.length).toBeGreaterThan(0)
      for (const element of answer.elements) seen.push(element.node)
      cursor = answer.cursor
      if (cursor === undefined) break
      expect(answer.elements.at(-1)?.node).toBe(cursor)
    }
    expect(cursor).toBeUndefined()
    expect(seen).toEqual(ids.map(String).sort())
  })

  it("fits one full element and its box on a page", () => {
    const big = elementId("1.1")
    const small = elementId("2.1")
    const deck = deckOf(
      4,
      grown([
        added(big),
        text(big, "m".repeat(limits.valueBytes)),
        { command: "person", node: big, property: "box", value: { x: 1, y: 2, cx: 3, cy: 4 } },
        added(small),
        text(small, "tail"),
      ]),
    )
    const answer = readDeckPage(deck, { runId: null })
    expect(withinRead(readReport(readLead(answer.revision), answer))).toBe(true)
    expect(answer.elements[0]).toMatchObject({
      node: big,
      value: "m".repeat(limits.valueBytes),
      box: { x: 1, y: 2, cx: 3, cy: 4 },
    })
    const rest = answer.cursor === undefined ? answer : readDeckPage(deck, { runId: null, cursor: answer.cursor })
    expect(rest.elements.some((element) => element.node === small)).toBe(true)
    expect(withinRead(readReport(readLead(rest.revision), rest))).toBe(true)
  })
})

describe("ownedDecks", () => {
  it("keeps the caller's decks, including Trash, in the given order", () => {
    const rows: OwnedRow[] = [
      { deck: "kept", name: "Kept", owner: "a@example.com", deleted: false, trash: true },
      { deck: "other", name: "Other", owner: "b@example.com", deleted: false, trash: false },
      { deck: "gone", name: "Gone", owner: "a@example.com", deleted: true, trash: false },
      { deck: "bad id", name: "Bad", owner: "a@example.com", deleted: false, trash: false },
      { deck: "live", name: "Live", owner: "a@example.com", deleted: false, trash: false },
    ]
    const owned: OwnedDeck[] = ownedDecks(rows, "a@example.com")
    expect(owned).toEqual([
      { deck: "kept", name: "Kept", trash: true },
      { deck: "live", name: "Live", trash: false },
    ])
    const listed: ListDeckAnswer = pageOwned(owned)
    expect(listed).toEqual({ ok: true, decks: owned })
    expect(listed.cursor).toBeUndefined()
    expect(readReport(listLead, listed)).toContain(listLead)
    expect(pageOwned(owned, "missing")).toEqual({ ok: true, decks: [] })
    expect(pageOwned(owned, "live")).toEqual({ ok: true, decks: [] })
    expect(pageOwned(owned, "kept").decks).toEqual([{ deck: "live", name: "Live", trash: false }])
  })

  it("pages a long list inside the read budget", () => {
    const rows: OwnedDeck[] = Array.from({ length: 80 }, (_, index) => {
      const parsed = readDeckId(`d${String(index).padStart(2, "0")}`)
      if (!parsed.ok) throw new Error(parsed.refusal)
      return { deck: parsed.deck, name: "n".repeat(180), trash: index % 2 === 0 }
    })
    const first = pageOwned(rows)
    expect(withinRead(readReport(listLead, first))).toBe(true)
    const seen: string[] = []
    let cursor: string | undefined
    for (let guard = 0; guard < 40; guard += 1) {
      const answer = pageOwned(rows, cursor)
      expect(withinRead(readReport(listLead, answer))).toBe(true)
      for (const row of answer.decks) seen.push(row.deck)
      cursor = answer.cursor
      if (cursor === undefined) break
    }
    expect(cursor).toBeUndefined()
    expect(seen).toEqual(rows.map((row) => row.deck))
  })
})

describe("design lines", () => {
  const palette = { slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" }, map: { tx1: "dk1", bg1: "lt1" } }
  const second = { slots: { dk1: "111111", accent1: "C0504D" }, map: { tx1: "dk1" } }
  const layout = [{ node: elementId("258.9"), kind: "shape", value: "", box, grouped: false, role: "title" }] as const

  function designed(): Deck {
    const indexed = indexDeck(
      openDeck(readDeckIdOf("designed")),
      { actor: "person" },
      {
        deck: "designed",
        format: 2,
        once: "designed",
        offset: 0,
        total: 2,
        palettes: [palette, second],
        slides: [
          { id: "258", position: 0, free: 9, layout },
          { id: "259", position: 1, palette: 1 },
        ],
        elements: [
          {
            node: elementId("258.2"),
            kind: "shape",
            value: "Quarterly review",
            box,
            grouped: false,
            role: "title",
            design: { "text.size": [36, "master"], "text.color": ["tx1", "master"], "body.anchor": ["b", "layout"] },
          },
          {
            node: elementId("259.7"),
            kind: "shape",
            value: null,
            box,
            grouped: false,
            design: { geometry: ["custom"], fill: ["accent1", "style"], "line.width": [1, "style"] },
            kept: ["geometry"],
          },
        ],
      },
    )
    if (!indexed.ok) throw new Error(indexed.refusal)
    return indexed.deck
  }

  it("prints each indexed element's role and design as one line, and the palettes its slides use", () => {
    const answer = readDeckPage(designed(), { runId: null })
    const read = byNode(answer)
    expect(read.get("258.2")).toEqual({
      node: elementId("258.2"),
      slide: "258",
      value: "Quarterly review",
      kind: "shape",
      grouped: false,
      version: 0,
      box,
      role: "title",
      design: "text.size 36 (master) · text.color tx1 (master) · body.anchor b (layout)",
    })
    expect(read.get("259.7")?.design).toBe("geometry custom · fill accent1 (style) · line.width 1 (style)")
    expect(read.get("259.7")).not.toHaveProperty("role")
    expect(answer.palettes).toEqual([palette, second])
    expect(answer.slides).toEqual([
      { id: "258", position: 0 },
      { id: "259", position: 1, palette: 1 },
    ])
  })

  it("prints the text design of the element's current first run once a change lands on it", () => {
    const deck = designed()
    const running = call(
      "start_run",
      deck,
      { actor: "agent", runId: "run" },
      {
        deck: "designed",
        runId: "run",
        elements: [{ node: "258.2" }],
      },
    )
    if (!running.ok) throw new Error(running.refusal)
    const set = call(
      "edit_deck",
      running.deck,
      { actor: "agent", runId: "run" },
      {
        deck: "designed",
        base: running.deck.revision,
        changes: [{ op: "set", target: "*.title", text: { color: "accent1 lumMod 75", size: 40 } }],
      },
    )
    if (!set.ok) throw new Error(set.refusal)
    expect(byNode(readDeckPage(set.deck, { runId: "run" })).get("258.2")?.design).toBe(
      "text.size 40 · text.color accent1 lumMod 75 · body.anchor b (layout)",
    )
  })

  it("prints the fill a change set, keeps it on a duplicate, and drops it once the fill goes back to inherited", () => {
    const crimson = "C00000"
    const actor = { actor: "agent", runId: "run" } as const
    const running = call("start_run", designed(), actor, {
      deck: "designed",
      runId: "run",
      elements: [{ node: "259.7" }],
    })
    if (!running.ok) throw new Error(running.refusal)
    const fill = (deck: Deck, value: unknown) => {
      const set = call("edit_deck", deck, actor, {
        deck: "designed",
        base: deck.revision,
        changes: [{ op: "set", target: "259.7", fill: { value } }],
      })
      if (!set.ok) throw new Error(set.refusal)
      return set.deck
    }
    const red = fill(running.deck, `#${crimson}`)
    expect(byNode(readDeckPage(red, { runId: "run" })).get("259.7")?.design).toBe(
      `geometry custom · fill #${crimson} · line.width 1 (style)`,
    )
    const copied = call("duplicate_slide", red, actor, { deck: "designed", base: red.revision, slide: "259" })
    if (!copied.ok) throw new Error(copied.refusal)
    const copy = readDeckPage(copied.deck, { runId: "run" }).elements.find(
      (element) => element.slide !== "258" && element.slide !== "259",
    )
    expect(copy?.design).toBe(`geometry custom · fill #${crimson} · line.width 1 (style)`)
    expect(byNode(readDeckPage(fill(red, null), { runId: "run" })).get("259.7")?.design).toBe(
      "geometry custom · line.width 1 (style)",
    )
  })

  it("prints the line fields a change set in place of the style's, and drops one once it goes back to inherited", () => {
    const actor = { actor: "agent", runId: "run" } as const
    const running = call("start_run", designed(), actor, {
      deck: "designed",
      runId: "run",
      elements: [{ node: "259.7" }],
    })
    if (!running.ok) throw new Error(running.refusal)
    const line = (deck: Deck, value: unknown) => {
      const set = call("edit_deck", deck, actor, {
        deck: "designed",
        base: deck.revision,
        changes: [{ op: "set", target: "259.7", line: value }],
      })
      if (!set.ok) throw new Error(set.refusal)
      return set.deck
    }
    const styled = line(running.deck, {
      width: 3,
      fill: "accent2",
      dash: "sysDot",
      tail: { type: "stealth", width: "lg", length: "lg" },
    })
    expect(byNode(readDeckPage(styled, { runId: "run" })).get("259.7")?.design).toBe(
      "geometry custom · fill accent1 (style) · line.width 3 · line.fill accent2 · line.dash sysDot · line.tail stealth",
    )
    const back = line(styled, { width: null, dash: "solid", tail: { type: "none", width: "med", length: "med" } })
    expect(byNode(readDeckPage(back, { runId: "run" })).get("259.7")?.design).toBe(
      "geometry custom · fill accent1 (style) · line.fill accent2",
    )
  })

  it("reads a slide added from a layout with the roles of its layout floor", () => {
    const deck = designed()
    const added = call(
      "add_slide",
      deck,
      { actor: "agent", runId: "run" },
      {
        deck: "designed",
        base: 0,
        after: "258",
        layout: "258",
      },
    )
    if (!added.ok) throw new Error(added.refusal)
    const fresh = readDeckPage(added.deck, { runId: "run" }).elements.filter(
      (element) => element.slide !== "258" && element.slide !== "259",
    )
    expect(fresh.map((element) => element.role)).toEqual(["title"])
    expect(fresh[0]).not.toHaveProperty("design")
  })
})
