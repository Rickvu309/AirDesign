import { describe, expect, it } from "vitest"
import { applyEdit, foldToJson, isRefusal, readFold, readLanded, rev, type Landed, type Doom } from "./index.js"
import { agent, box, create, ids, land, once, person, sampleDeck } from "./sample-deck.js"
import { valuesOf } from "./testing/values-of.js"

const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

const childrenOf = (doom: Doom) =>
  Object.fromEntries(
    [...doom.children].filter(([, list]) => list.length > 0).sort(([left], [right]) => (left < right ? -1 : 1)),
  )

function sameDoom(left: Doom, right: Doom) {
  expect(valuesOf(right)).toEqual(valuesOf(left))
  expect([...right.revs].map(([node, revs]) => [node, [...revs]])).toEqual(
    [...left.revs].map(([node, revs]) => [node, [...revs]]),
  )
  expect(childrenOf(right)).toEqual(childrenOf(left))
  expect(right.rev).toBe(left.rev)
  expect([...right.onces]).toEqual([...left.onces])
  expect([...right.runs].map(([name, run]) => [name, { ...run, guarded: [...run.guarded] }])).toEqual(
    [...left.runs].map(([name, run]) => [name, { ...run, guarded: [...run.guarded] }]),
  )
}

describe("the fold's JSON form", () => {
  it("reads back the doom it was written from, through JSON, with the same order, revs, onces and runs", () => {
    let doom = sampleDeck()
    doom = land(doom, [{ node: ids.card, prop: "name", value: "Card" }])
    doom = land(doom, [{ node: ids.title, prop: "parent", value: { id: ids.side, at: "a1" } }])
    const started = applyEdit(doom, {
      once: once(),
      author: agent("run-1"),
      writes: [],
      phase: "start",
      rev: rev(doom.rev + 1),
    })
    if (isRefusal(started)) throw new Error("run")
    doom = land(started, [{ node: ids.card, prop: "box", value: box(7) }])
    const read = readFold(wire(foldToJson(doom)))
    expect(read).toBeDefined()
    sameDoom(doom, read!)
  })

  it("reads a stored run that names no agent as nobody's, so no agent can write into it or stop it", () => {
    const read = readFold({
      ...(wire(foldToJson(sampleDeck())) as object),
      runs: { old: { phase: "running", guarded: [] } },
    })
    expect(read?.runs.get("old")).toMatchObject({ phase: "running", agent: "" })
  })

  it("keeps a deleted node out of its parent's children and still holds its props", () => {
    const doom = land(sampleDeck(), [{ node: ids.caption, prop: "parent", value: null }])
    const read = readFold(wire(foldToJson(doom)))!
    expect(read.children.get(ids.side) ?? []).toEqual([])
    expect(read.nodes.get(ids.caption)).toMatchObject({ parent: null })
  })

  it("lets the read doom take the next edit the way the original does", () => {
    const doom = sampleDeck()
    const read = readFold(wire(foldToJson(doom)))!
    const writes = [{ node: ids.card, prop: "name" as const, value: "Next" }]
    const land = { once: once(), author: person, writes, rev: rev(doom.rev + 1) }
    const left = applyEdit(read, land)
    const right = applyEdit(doom, land)
    if (isRefusal(left) || isRefusal(right)) throw new Error("refused")
    sameDoom(right, left)
  })

  it("refuses a stored linked node", () => {
    const node = { id: "t:1", rev: 1, type: "component" }
    expect(readFold({ rev: 1, nodes: { [node.id]: node }, revs: {}, onces: {}, runs: {} })).toBeUndefined()
  })

  it.each([
    ["not an object", 7],
    ["no nodes", { rev: 1, revs: {}, onces: {}, runs: {} }],
    [
      "a node under its own key's wrong id",
      { rev: 1, nodes: { "t:1": { id: "t:2", rev: 1, type: "deck" } }, revs: {}, onces: {}, runs: {} },
    ],
    [
      "a node of an unknown type",
      { rev: 1, nodes: { "t:1": { id: "t:1", rev: 1, type: "wall" } }, revs: {}, onces: {}, runs: {} },
    ],
    [
      "a prop its type does not take",
      { rev: 1, nodes: { "t:1": { id: "t:1", rev: 1, type: "deck", box: {} } }, revs: {}, onces: {}, runs: {} },
    ],
    [
      "a prop value its reader refuses",
      { rev: 1, nodes: { "t:1": { id: "t:1", rev: 1, type: "deck", name: 7 } }, revs: {}, onces: {}, runs: {} },
    ],
    [
      "a parent that is not in the doom",
      {
        rev: 1,
        nodes: { "t:2": { id: "t:2", rev: 1, type: "slideRow", parent: { id: "t:1", at: "a0" } } },
        revs: {},
        onces: {},
        runs: {},
      },
    ],
    ["a rev that is not a whole number", { rev: 1.5, nodes: {}, revs: {}, onces: {}, runs: {} }],
    ["revs for a node that is not there", { rev: 1, nodes: {}, revs: { "t:9": { name: 1 } }, onces: {}, runs: {} }],
  ])("refuses a fold with %s", (_name, raw) => {
    expect(readFold(raw)).toBeUndefined()
  })

  it("reads each stored fold's props with the same readers as a write", () => {
    const raw = wire(foldToJson(sampleDeck())) as { nodes: Record<string, { box?: unknown }> }
    const card = raw.nodes[ids.card]
    if (card === undefined) throw new Error("card")
    card.box = { ...(card.box as object), w: -5 }
    expect(readFold(raw)).toBeUndefined()
  })
})

describe("a landed edit's JSON form", () => {
  const landed = (doom: Doom): Landed => ({
    once: "o-1",
    author: person,
    writes: [{ node: ids.card, prop: "name", value: "Card" }],
    rev: rev(doom.rev + 1),
  })

  it.each([
    { node: "t:90", prop: "type", value: "component" },
    { node: ids.card, prop: "instance", value: null },
  ])("refuses an edit that writes a linked node or property", (write) => {
    const doom = sampleDeck()
    expect(isRefusal(readLanded({ ...landed(doom), writes: [write] }, doom))).toBe(true)
  })

  it("reads an edit and its rev against the doom it lands on", () => {
    const doom = sampleDeck()
    const read = readLanded(wire(landed(doom)), doom)
    expect(read).toEqual(landed(doom))
  })

  it("refuses an edit with no rev, a rev it cannot read or a field the edit does not have", () => {
    const doom = sampleDeck()
    const { rev: _rev, ...bare } = landed(doom)
    expect(isRefusal(readLanded(wire(bare), doom))).toBe(true)
    expect(isRefusal(readLanded({ ...landed(doom), rev: -1 }, doom))).toBe(true)
    expect(isRefusal(readLanded({ ...landed(doom), extra: 1 }, doom))).toBe(true)
    expect(isRefusal(readLanded(null, doom))).toBe(true)
  })

  it("reads the nodes an edit creates, which the doom does not hold yet", () => {
    const doom = sampleDeck()
    const writes = create(ids.title, "shape", ids.card).slice(0, 2)
    const raw = { once: "o-2", author: person, writes: wire(writes), rev: doom.rev + 1 }
    const rest = {
      once: "o-3",
      author: person,
      writes: [{ node: "t:99", prop: "name", value: "x" }],
      rev: doom.rev + 1,
    }
    expect(isRefusal(readLanded(raw, doom))).toBe(false)
    expect(readLanded(rest, doom)).toEqual({ refused: "missing", node: "t:99", prop: "name" })
  })
})
