import { describe, expect, it } from "vitest"
import { limits } from "../limits.js"
import { isRefusal, nodeId, props, accepts, readEdit, readWrite, rev, type NodeType, type PropName } from "./index.js"
import { box, hex, ids, person, place, sampleDeck, textOf, theme } from "./sample-deck.js"

const scene = sampleDeck()

describe("readWrite", () => {
  it("reads a write that came through JSON and returns it as typed values", () => {
    const raw = JSON.parse(JSON.stringify({ node: ids.card, prop: "box", value: box(5), base: 2 }))
    expect(readWrite(raw, scene)).toEqual({ node: ids.card, prop: "box", value: box(5), base: rev(2) })
  })

  it("returns a write with no base key when none was sent", () => {
    expect(readWrite({ node: ids.card, prop: "name", value: "Card" }, scene)).toStrictEqual({
      node: ids.card,
      prop: "name",
      value: "Card",
    })
  })

  it("refuses what is not a write", () => {
    for (const raw of [null, 3, "x", [], {}, { node: ids.card }, { node: ids.card, prop: "name" }])
      expect(readWrite(raw, scene)).toMatchObject({ refused: "shape" })
  })

  it("refuses a bad node id, an unknown prop, a stray key and a bad base", () => {
    expect(readWrite({ node: "no", prop: "name", value: "x" }, scene)).toMatchObject({ refused: "shape" })
    expect(readWrite({ node: ids.card, prop: "colour", value: "x" }, scene)).toMatchObject({
      refused: "shape",
      node: ids.card,
    })
    expect(readWrite({ node: ids.card, prop: "name", value: "x", extra: 1 }, scene)).toMatchObject({ refused: "shape" })
    for (const base of [-1, 1.5, "1", null])
      expect(readWrite({ node: ids.card, prop: "name", value: "x", base }, scene)).toMatchObject({ refused: "shape" })
  })

  it("refuses a prop the node's type does not accept, naming the node and the prop", () => {
    expect(readWrite({ node: ids.card, prop: "text", value: textOf("x") }, scene)).toEqual({
      refused: "shape",
      node: ids.card,
      prop: "text",
    })
  })

  it("says kept, not shape, for a kept node's prop it cannot take", () => {
    expect(readWrite({ node: ids.kept, prop: "fills", value: [] }, scene)).toMatchObject({ refused: "kept" })
  })

  it("says missing for a node it does not hold, and lets a type write create one", () => {
    expect(readWrite({ node: "t:77", prop: "name", value: "x" }, scene)).toMatchObject({ refused: "missing" })
    expect(readWrite({ node: "t:77", prop: "type", value: "frame" }, scene)).toEqual({
      node: "t:77",
      prop: "type",
      value: "frame",
    })
    expect(readWrite({ node: "t:77", prop: "type", value: "table" }, scene)).toMatchObject({ refused: "shape" })
  })

  it("answers limit for a name or a text that is too long", () => {
    expect(readWrite({ node: ids.card, prop: "name", value: "é".repeat(limits.name) }, scene)).toMatchObject({
      refused: "limit",
    })
    expect(
      readWrite({ node: ids.title, prop: "text", value: textOf("a".repeat(limits.valueBytes + 1)) }, scene),
    ).toMatchObject({
      refused: "limit",
    })
  })

  it("reads theme keys by their own readers", () => {
    expect(readWrite({ node: ids.deck, prop: "theme.fonts.heading", value: "Fraunces" }, scene)).toMatchObject({
      value: "Fraunces",
    })
    expect(readWrite({ node: ids.deck, prop: "theme.colors.nope", value: hex(0xffffff) }, scene)).toMatchObject({
      refused: "shape",
    })
  })
})

describe("readEdit", () => {
  it("reads writes to a node its own earlier write creates", () => {
    const raw = {
      once: "o-1",
      author: person,
      writes: [
        { node: "t:77", prop: "type", value: "frame" },
        { node: "t:77", prop: "parent", value: place(ids.slide) },
        { node: "t:77", prop: "box", value: box(1) },
      ],
    }
    const read = readEdit(JSON.parse(JSON.stringify(raw)), scene)
    expect(isRefusal(read)).toBe(false)
    expect(read).toMatchObject({ once: "o-1", writes: [{ node: "t:77" }, {}, {}] })
  })

  it("refuses a write before the write that creates its node", () => {
    const raw = {
      once: "o-2",
      author: person,
      writes: [
        { node: "t:77", prop: "box", value: box(1) },
        { node: "t:77", prop: "type", value: "frame" },
      ],
    }
    expect(readEdit(raw, scene)).toMatchObject({ refused: "missing" })
  })

  it("refuses an edit with no once, a bad author or a stray key", () => {
    const good = { once: "o-3", author: person, writes: [] }
    expect(isRefusal(readEdit(good, scene))).toBe(false)
    for (const raw of [
      { ...good, once: "" },
      { ...good, author: { kind: "robot", id: "x" } },
      { ...good, author: { kind: "person", id: "x", run: "r" } },
      { ...good, writes: "no" },
      { ...good, stray: 1 },
      { ...good, phase: "pause" },
    ])
      expect(readEdit(raw, scene)).toMatchObject({ refused: "shape" })
  })

  it("answers limit for a once that is too long", () => {
    expect(readEdit({ once: "x".repeat(200), author: person, writes: [] }, scene)).toMatchObject({ refused: "limit" })
  })

  it("keeps an agent's run and a phase", () => {
    const raw = { once: "o-4", author: { kind: "agent", id: "aira", run: "r1" }, phase: "start", writes: [] }
    expect(readEdit(raw, scene)).toStrictEqual(raw)
  })
})

describe("the property list", () => {
  const names = Object.keys(props) as PropName[]

  it("has one entry per property of every type's accepts, and accepts only names the list has", () => {
    for (const type of Object.keys(accepts) as NodeType[])
      for (const name of accepts[type]) expect(names).toContain(name)
    for (const name of names)
      expect(Object.values(accepts).some((own) => (own as readonly string[]).includes(name))).toBe(true)
  })

  it("gives each entry its control, agent description, PowerPoint answer and conflict rule", () => {
    for (const name of names) {
      const spec = props[name]
      expect(typeof spec.read).toBe("function")
      expect(["none", "number", "color", "paints", "text", "choice", "toggle", "box", "custom"]).toContain(spec.control)
      expect(spec.describe === null || (typeof spec.describe === "string" && spec.describe.length > 0)).toBe(true)
      expect(["native", "picture", "dropped"]).toContain(spec.pptx)
      expect(["last", "base"]).toContain(spec.conflict)
    }
  })

  it("makes text, notes and the paint and effect lists compare and set, and nothing else", () => {
    expect(names.filter((name) => props[name].conflict === "base").sort()).toEqual([
      "effects",
      "fills",
      "notes",
      "strokes",
      "text",
    ])
  })

  it("keeps each reader's own typed value when read twice", () => {
    const samples: Partial<Record<PropName, unknown>> = {
      box: box(3),
      text: textOf("a\nb"),
      theme: theme(),
      fills: [{ kind: "solid", color: { var: "accent1", tint: 0.2 }, opacity: 0.5 }],
      radius: [1, 2, 3, 4],
      parent: place(ids.slide),
      layout: {
        mode: "grid",
        columns: [{ fr: 1 }, { px: 200 }, "hug"],
        rows: ["hug"],
        gap: 8,
        padding: { t: 0, r: 0, b: 0, l: 0 },
      },
    }
    for (const [name, raw] of Object.entries(samples)) {
      const read = props[name as PropName].read(raw)
      expect(isRefusal(read)).toBe(false)
      expect(props[name as PropName].read(JSON.parse(JSON.stringify(read)))).toEqual(read)
    }
  })

  it("names a node id by client and counter", () => {
    expect(nodeId("c9:12")).toBe("c9:12")
    expect(() => nodeId("12")).toThrow()
  })
})
