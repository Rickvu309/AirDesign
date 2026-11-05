import { describe, expect, it } from "vitest"
import { apply, flatten, id, parseChangeSet, parseDeck } from "../src/index.ts"
import { fixtureDeck, fixtureElement } from "../src/fixture.ts"
import type { ChangeSet, Deck, Element } from "../src/model.ts"
const deck = fixtureDeck(3)
const slide = deck.slides[0]!
const first = slide.elements[0]!
const group: Element = { ...fixtureElement(99), kind: "group", children: [fixtureElement(101), fixtureElement(102)] }
function success(changeSet: ChangeSet, input = deck) {
  const result = apply(input, changeSet)
  if (!result.ok) throw new Error(result.error.message)
  return result
}
function semantic(value: Deck) { return { ...value, version: 0, slides: value.slides.map(s => ({ ...s, version: 0 })) } }
describe("canonical atomic changes", () => {
  it("serializes and reopens without losing sources, themes, notes or arbitrary sizes", () => {
    const original = { kind: "original", part: "ppt/slides/slide1.xml", sha256: "a".repeat(64), objectId: "42", dependencies: ["ppt/media/image1.png"] } as const
    const value: Deck = { ...deck, slides: [{ ...slide, size: { width: 777, height: 888 }, elements: [{ ...first, source: { ...original, dependencies: [...original.dependencies] }, support: { kind: "kept", preview: "data:image/png;base64,AA==" }, placeholder: "title" }, { ...slide.elements[1]!, support: { kind: "flagged", reason: "Unsupported effect", preview: null } }] }] }
    expect(parseDeck(JSON.parse(JSON.stringify(value)))).toEqual(value)
  })
  it("inserts a unique stable slide at the requested position", () => {
    const added = { ...slide, id: id("added"), elements: [], size: { width: 777, height: 888 } }
    const result = success({ changes: [{ kind: "insert", parent: deck.id, index: 0, value: added }] })
    expect(result.deck.slides.map(s => s.id)).toEqual(["added", slide.id])
  })
  it("inserts a group with its exact children then moves a child between parents", () => {
    const inserted = success({ changes: [{ kind: "insert", parent: slide.id, index: 1, value: group }] }).deck
    const moved = success({ changes: [{ kind: "move", target: first.id, parent: group.id, index: 1 }] }, inserted).deck
    const actual = moved.slides[0]!.elements[0]!
    expect(actual.kind).toBe("group")
    if (actual.kind === "group") expect(actual.children.map(e => e.id)).toEqual(["e101", first.id, "e102"])
    expect(flatten(moved.slides[0]!.elements).filter(e => e.id === first.id)).toHaveLength(1)
    const removed = success({ changes: [{ kind: "remove", target: group.id }] }, moved).deck
    expect(removed.slides[0]!.elements.map(e => e.id)).toEqual(slide.elements.slice(1).map(e => e.id))
  })
  it("preserves Unicode runs and inverses without mutating input or untouched elements", () => {
    if (first.kind !== "text") throw new Error("text fixture")
    const before = JSON.stringify(deck)
    const value = { ...first, runs: [{ ...first.runs[0]!, text: "Tiếng Việt 日本語 é 👩🏽‍💻" }, { ...first.runs[0]!, text: "Second style", bold: false, color: "#102030" }] }
    const changed = success({ changes: [{ kind: "set", target: first.id, value }] })
    expect(changed.deck.slides[0]!.elements[1]).toBe(slide.elements[1])
    expect(changed.deck.slides[0]!.elements[0]).toEqual(value)
    expect(semantic(success(changed.inverse, changed.deck).deck)).toEqual(semantic(deck))
    expect(JSON.stringify(deck)).toBe(before)
  })
  it("rejects a cycle and dangling references with zero partial writes", () => {
    const inserted = success({ changes: [{ kind: "insert", parent: slide.id, index: 1, value: group }] }).deck
    const before = JSON.stringify(inserted)
    const result = apply(inserted, { changes: [{ kind: "remove", target: first.id }, { kind: "move", target: group.id, parent: id("e101"), index: 0 }] })
    expect(result).toMatchObject({ ok: false, error: { code: "cycle" } })
    expect(JSON.stringify(inserted)).toBe(before)
    expect(apply(deck, { changes: [{ kind: "remove", target: id("missing") }] })).toMatchObject({ ok: false, error: { code: "invalid-reference" } })
  })
  it("never reuses a thumbnail revision when editing after an inverse", () => {
    const changed = success({ changes: [{ kind: "set", target: first.id, value: { ...first, box: { ...first.box, x: 10 } } }] })
    const restored = success(changed.inverse, changed.deck).deck
    const edited = success({ changes: [{ kind: "set", target: first.id, value: { ...first, box: { ...first.box, x: 20 } } }] }, restored).deck
    expect(restored.slides[0]!.version).toBeGreaterThan(changed.deck.slides[0]!.version)
    expect(edited.slides[0]!.version).toBeGreaterThan(restored.slides[0]!.version)
    expect(semantic(restored)).toEqual(semantic(deck))
  })
  it("rejects duplicate ids, invalid positions, mismatched replacements and malformed JSON", () => {
    expect(apply(deck, { changes: [{ kind: "insert", parent: slide.id, index: 1, value: first }] }).ok).toBe(false)
    expect(apply(deck, { changes: [{ kind: "move", target: first.id, parent: slide.id, index: 50 }] }).ok).toBe(false)
    expect(apply(deck, { changes: [{ kind: "set", target: first.id, value: fixtureElement(600) }] }).ok).toBe(false)
    expect(() => parseChangeSet({ changes: [{ kind: "remove", target: "../../" }] })).toThrow()
    expect(() => parseDeck({ ...deck, slides: [{ ...slide, size: { width: -1, height: 0 } }] })).toThrow()
  })
})
